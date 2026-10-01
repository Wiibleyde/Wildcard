import type { SupabaseClient } from "@supabase/supabase-js";
import {
    resolveGameModule,
    resolveLaunchableModule,
} from "@/lib/games/resolve";
import type { Database } from "@/lib/supabase/types";
import { insertRoom, startGame } from "./room";

type Admin = SupabaseClient<Database>;

export type MatchErrorCode =
    | "unknown_game"
    | "not_matchmakable"
    | "match_in_progress"
    | "db_error";

/** HTTP status for each matchmaking error — keeps route handlers thin. */
export const MATCH_ERROR_STATUS: Record<MatchErrorCode, number> = {
    unknown_game: 400,
    not_matchmakable: 400,
    match_in_progress: 409,
    db_error: 500,
};

type Result<T> =
    | ({ ok: true } & T)
    | { ok: false; error: MatchErrorCode; message?: string };

/**
 * What a player's quick-match ticket currently means, as the client polls /
 * reacts to it:
 *  - `idle`       — no ticket; not in the queue.
 *  - `searching`  — waiting for opponents (`waiting` = players queued for the
 *                   same game, for a live counter).
 *  - `matched`    — paired and the game is dealt; walk into `gameId`.
 */
export type MatchStatus =
    | { status: "idle" }
    | { status: "searching"; moduleId: string; waiting: number }
    | { status: "matched"; gameId: string; code: string };

/** Errors here are swallowed into a status, so make them visible to operators. */
function logDbError(what: string, error: { message: string } | null): void {
    if (error) console.error(`[matchmaking] ${what} failed:`, error.message);
}

/**
 * A matched ticket whose room row is missing is normally mid-formation (the
 * matcher stamps the room id *before* the room is inserted — a sub-second
 * window). Past this age it can only be a formation that died half-way (crash
 * between claim and insert), and the ticket is treated as dead so the player is
 * never locked out of the queue.
 */
const MISSING_ROOM_STALE_MS = 2 * 60_000;

/** Where a matched ticket's room stands. */
type TicketRoom =
    | { kind: "live"; code: string; gameId: string | null }
    | { kind: "finished" }
    | { kind: "missing" }
    | { kind: "error"; message: string };

async function resolveTicketRoom(
    admin: Admin,
    roomId: string,
): Promise<TicketRoom> {
    const { data: room, error } = await admin
        .from("rooms")
        .select("code, status, current_game_id")
        .eq("id", roomId)
        .maybeSingle();
    if (error) return { kind: "error", message: error.message };
    if (!room) return { kind: "missing" };
    if (room.status === "finished") return { kind: "finished" };
    if (room.current_game_id) {
        // An admin force-end flips `games.is_over` — treat it as finished too.
        const { data: game, error: gameError } = await admin
            .from("games")
            .select("is_over")
            .eq("id", room.current_game_id)
            .maybeSingle();
        if (gameError) return { kind: "error", message: gameError.message };
        if (game?.is_over) return { kind: "finished" };
    }
    return { kind: "live", code: room.code, gameId: room.current_game_id };
}

/**
 * Is a matched ticket spent — its game over, or its room never materialised?
 * A spent ticket must neither block a new search nor keep pointing the player
 * back at an old game.
 */
function isSpent(room: TicketRoom, ticketCreatedAt: string): boolean {
    if (room.kind === "finished") return true;
    return (
        room.kind === "missing" &&
        Date.now() - new Date(ticketCreatedAt).getTime() >=
            MISSING_ROOM_STALE_MS
    );
}

/** Drop a spent ticket — only if it still points at that same room. */
async function dropSpentTicket(
    admin: Admin,
    userId: string,
    roomId: string,
): Promise<void> {
    const { error } = await admin
        .from("matchmaking_tickets")
        .delete()
        .eq("user_id", userId)
        .eq("room_id", roomId);
    logDbError("drop spent ticket", error);
}

/**
 * Materialise a matched (or bot-filled) group into a real, started game: create
 * the room under the id the matcher pre-allocated (tickets already point at it),
 * seat everyone in claim order — host first — and deal via the shared
 * {@link startGame}. Returns the new game id to navigate to.
 */
async function seatAndStart(
    admin: Admin,
    roomId: string,
    moduleId: string,
    userIds: string[],
    visibility: "public" | "private",
    botCount: number,
): Promise<{ ok: true; gameId: string } | { ok: false; message?: string }> {
    // No orphan lobby on a half-finished deal. FK order: seats before room.
    const teardown = async () => {
        const seats = await admin
            .from("room_players")
            .delete()
            .eq("room_id", roomId);
        logDbError("teardown seats", seats.error);
        const rooms = await admin.from("rooms").delete().eq("id", roomId);
        logDbError("teardown room", rooms.error);
    };

    const room = await insertRoom(admin, {
        id: roomId,
        moduleId,
        hostId: userIds[0],
        visibility,
        botCount,
    });
    if (!room.ok) return { ok: false, message: room.message };

    const seats = userIds.map((id, i) => ({
        room_id: roomId,
        user_id: id,
        seat: i,
        role: "player" as const,
    }));
    const { error: seatErr } = await admin.from("room_players").insert(seats);
    if (seatErr) {
        await teardown();
        return { ok: false, message: seatErr.message };
    }

    // The matcher seats the earliest ticket as host; startGame gates on that.
    const started = await startGame(admin, userIds[0], room.code);
    if (!started.ok) {
        await teardown();
        return { ok: false, message: started.message ?? started.error };
    }
    return { ok: true, gameId: started.gameId };
}

/**
 * Attempt to form one game from the waiting pool. The atomic `match_make` RPC
 * (FOR UPDATE SKIP LOCKED) either hands back a claimed group bound to a fresh
 * room id, or nothing when fewer than `min` are ready.
 *
 * On a formation failure we release the claim and retry, bounded: a failure is
 * almost always transient (a DB blip), and retrying in place means the released
 * group doesn't sit stranded until the next enqueue happens to tick the matcher
 * again. After a few failures we give up and leave them queued for the next
 * enqueue — no client polling needed to recover.
 */
async function tryForm(
    admin: Admin,
    moduleId: string,
    min: number,
    max: number,
): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await admin.rpc("match_make", {
            p_module_id: moduleId,
            p_min: min,
            p_max: max,
        });
        if (error) {
            logDbError("match_make", error);
            return;
        }
        if (!data || data.length === 0) return;

        const roomId = data[0].room_id;
        const userIds = data.map((r) => r.user_id);
        const res = await seatAndStart(
            admin,
            roomId,
            moduleId,
            userIds,
            "public",
            0,
        );
        if (res.ok) return;
        console.error("[matchmaking] formation failed:", res.message);

        const { error: releaseError } = await admin
            .from("matchmaking_tickets")
            .update({ room_id: null })
            .in("user_id", userIds)
            .eq("room_id", roomId);
        logDbError("release claimed group", releaseError);
    }
}

/** Form a game from `moduleId`'s waiting pool, if enough players are ready. */
async function formFor(admin: Admin, moduleId: string): Promise<void> {
    // A pool already exists for this module id, so resolve status-agnostic.
    const module = await resolveGameModule(admin, moduleId);
    if (!module || module.maxPlayers <= 1) return;
    await tryForm(admin, moduleId, module.minPlayers, module.maxPlayers);
}

/**
 * Resolve the caller's current ticket into a {@link MatchStatus}. A ticket
 * whose game is over is spent: it is dropped and reported `idle`, so the hub
 * never pulls the player back into a finished game.
 */
export async function getMatchStatus(
    admin: Admin,
    userId: string,
): Promise<MatchStatus> {
    const { data: ticket, error } = await admin
        .from("matchmaking_tickets")
        .select("module_id, room_id, created_at")
        .eq("user_id", userId)
        .maybeSingle();
    logDbError("read ticket", error);
    if (!ticket) return { status: "idle" };

    if (!ticket.room_id) {
        const { count, error: countError } = await admin
            .from("matchmaking_tickets")
            .select("user_id", { count: "exact", head: true })
            .eq("module_id", ticket.module_id)
            .is("room_id", null);
        logDbError("count waiting", countError);
        return {
            status: "searching",
            moduleId: ticket.module_id,
            waiting: count ?? 1,
        };
    }

    const room = await resolveTicketRoom(admin, ticket.room_id);
    if (room.kind === "error") {
        console.error("[matchmaking] resolve room failed:", room.message);
    }
    if (room.kind === "finished") {
        await dropSpentTicket(admin, userId, ticket.room_id);
        return { status: "idle" };
    }
    // A missing room (formation in flight) or a not-yet-dealt game is a
    // sub-second window — report "searching" so the client holds rather than
    // navigating nowhere. Never auto-dropped here: a poll landing inside that
    // window must not break a match that is being dealt.
    if (room.kind !== "live" || !room.gameId) {
        return { status: "searching", moduleId: ticket.module_id, waiting: 1 };
    }
    return { status: "matched", gameId: room.gameId, code: room.code };
}

/**
 * Put the caller's ticket in the searching state for `moduleId`, without ever
 * clobbering a live match. A blind upsert (`room_id: null`) would let a second
 * tab / a retry un-match a player who was just paired — they would then be
 * seated in two games. Instead:
 *
 * - no ticket → insert (`on conflict do nothing`, so a concurrent insert wins);
 * - searching ticket → refresh it;
 * - matched to a live room → refuse with `match_in_progress`;
 * - matched to a spent room (game over / never materialised) → recycle it.
 *
 * Every write is a compare-and-set on the `room_id` just inspected, so a match
 * landing between the read and the write turns the write into a no-op and the
 * loop re-reads the new state.
 */
async function claimSearchingTicket(
    admin: Admin,
    userId: string,
    moduleId: string,
): Promise<Result<object>> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data: ticket, error } = await admin
            .from("matchmaking_tickets")
            .select("room_id, created_at")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) {
            return { ok: false, error: "db_error", message: error.message };
        }

        const now = new Date().toISOString();
        if (!ticket) {
            const { data: inserted, error: insertError } = await admin
                .from("matchmaking_tickets")
                .upsert(
                    {
                        user_id: userId,
                        module_id: moduleId,
                        room_id: null,
                        created_at: now,
                    },
                    { onConflict: "user_id", ignoreDuplicates: true },
                )
                .select("user_id");
            if (insertError) {
                return {
                    ok: false,
                    error: "db_error",
                    message: insertError.message,
                };
            }
            if (inserted && inserted.length > 0) return { ok: true };
            continue; // lost an insert race — re-read what won
        }

        if (ticket.room_id) {
            const room = await resolveTicketRoom(admin, ticket.room_id);
            if (room.kind === "error") {
                return { ok: false, error: "db_error", message: room.message };
            }
            if (!isSpent(room, ticket.created_at)) {
                return { ok: false, error: "match_in_progress" };
            }
        }

        const base = admin
            .from("matchmaking_tickets")
            .update({ module_id: moduleId, room_id: null, created_at: now })
            .eq("user_id", userId);
        const { data: updated, error: updateError } = await (ticket.room_id
            ? base.eq("room_id", ticket.room_id)
            : base.is("room_id", null)
        ).select("user_id");
        if (updateError) {
            return {
                ok: false,
                error: "db_error",
                message: updateError.message,
            };
        }
        if (updated && updated.length > 0) return { ok: true };
        // The ticket changed under us (most likely: just matched) — re-read.
    }
    return { ok: false, error: "match_in_progress" };
}

/**
 * Join (or refresh) the quick-match queue for `moduleId`, then immediately try
 * to form a game. One ticket per user (PK on user_id). Returns the caller's
 * resulting status — `matched` already if their enqueue completed a group.
 */
export async function enqueue(
    admin: Admin,
    userId: string,
    moduleId: string,
): Promise<Result<MatchStatus>> {
    const module = await resolveLaunchableModule(admin, moduleId, userId);
    if (!module) return { ok: false, error: "unknown_game" };
    if (module.maxPlayers <= 1) return { ok: false, error: "not_matchmakable" };

    const claimed = await claimSearchingTicket(admin, userId, moduleId);
    if (!claimed.ok) return claimed;

    await formFor(admin, moduleId);

    const status = await getMatchStatus(admin, userId);
    return { ok: true, ...status };
}

/**
 * Stop searching: deal the caller a private game right now, filling the empty
 * seats with bots up to the game's minimum. Pulls the caller out of the queue
 * atomically first, so a human match landing at the same instant wins instead
 * of dealing two games.
 */
export async function playWithBots(
    admin: Admin,
    userId: string,
    moduleId: string,
): Promise<Result<{ gameId: string }>> {
    const module = await resolveLaunchableModule(admin, moduleId, userId);
    if (!module) return { ok: false, error: "unknown_game" };

    const roomId = crypto.randomUUID();
    const { data: claimed, error: claimError } = await admin
        .from("matchmaking_tickets")
        .update({ room_id: roomId })
        .eq("user_id", userId)
        .is("room_id", null)
        .select("user_id");
    if (claimError) {
        return { ok: false, error: "db_error", message: claimError.message };
    }

    // Losing the claim means either a human match grabbed the ticket first
    // (room_id set → honour it, never deal a second game; the not-yet-dealt
    // window → keep waiting), the ticket is spent (its game is over → drop it
    // and deal fresh), or the player never queued (no ticket → deal solo+bots).
    if (!claimed || claimed.length === 0) {
        const { data: ticket, error: ticketError } = await admin
            .from("matchmaking_tickets")
            .select("room_id, created_at")
            .eq("user_id", userId)
            .maybeSingle();
        if (ticketError) {
            return {
                ok: false,
                error: "db_error",
                message: ticketError.message,
            };
        }
        if (ticket?.room_id) {
            const room = await resolveTicketRoom(admin, ticket.room_id);
            if (room.kind === "error") {
                return { ok: false, error: "db_error", message: room.message };
            }
            if (!isSpent(room, ticket.created_at)) {
                return room.kind === "live" && room.gameId
                    ? { ok: true, gameId: room.gameId }
                    : { ok: false, error: "match_in_progress" };
            }
            await dropSpentTicket(admin, userId, ticket.room_id);
        }
    }

    const botCount = Math.max(0, module.minPlayers - 1);
    // Defensive: a misconfigured module (min > max) would over-fill the table.
    // Unlike enqueue, a 1-seat game is fine here — a solo deal is the point.
    if (1 + botCount > module.maxPlayers) {
        return { ok: false, error: "not_matchmakable" };
    }

    const res = await seatAndStart(
        admin,
        roomId,
        moduleId,
        [userId],
        "private",
        botCount,
    );
    if (!res.ok) {
        // seatAndStart tore its room down; release the claim so the ticket
        // doesn't dangle at a room that no longer exists.
        if (claimed && claimed.length > 0) {
            const { error: releaseError } = await admin
                .from("matchmaking_tickets")
                .update({ room_id: null })
                .eq("user_id", userId)
                .eq("room_id", roomId);
            logDbError("release bot claim", releaseError);
        }
        return { ok: false, error: "db_error", message: res.message };
    }
    return { ok: true, gameId: res.gameId };
}

/** Leave the queue — only drops a still-searching ticket, never a matched one. */
export async function leaveQueue(
    admin: Admin,
    userId: string,
): Promise<{ ok: true }> {
    const { error } = await admin
        .from("matchmaking_tickets")
        .delete()
        .eq("user_id", userId)
        .is("room_id", null);
    logDbError("leave queue", error);
    return { ok: true };
}

/**
 * Drop the caller's ticket unconditionally — used to *consume* a match once the
 * player has walked into the game (a matched ticket holds a non-null room_id, so
 * {@link leaveQueue} would leave it behind). Without this a spent ticket lingers
 * as `matched` and pulls the player back into the finished game next time they
 * open the hub.
 */
export async function clearTicket(
    admin: Admin,
    userId: string,
): Promise<{ ok: true }> {
    const { error } = await admin
        .from("matchmaking_tickets")
        .delete()
        .eq("user_id", userId);
    logDbError("clear ticket", error);
    return { ok: true };
}
