import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameModule } from "@/lib/games";
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
        await admin.from("room_players").delete().eq("room_id", roomId);
        await admin.from("rooms").delete().eq("id", roomId);
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
        if (error || !data || data.length === 0) return;

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

        await admin
            .from("matchmaking_tickets")
            .update({ room_id: null })
            .in("user_id", userIds);
    }
}

/** Form a game from `moduleId`'s waiting pool, if enough players are ready. */
async function formFor(admin: Admin, moduleId: string): Promise<void> {
    const module = getGameModule(moduleId);
    if (!module || module.maxPlayers <= 1) return;
    await tryForm(admin, moduleId, module.minPlayers, module.maxPlayers);
}

/** Resolve the caller's current ticket into a {@link MatchStatus}. */
export async function getMatchStatus(
    admin: Admin,
    userId: string,
): Promise<MatchStatus> {
    const { data: ticket } = await admin
        .from("matchmaking_tickets")
        .select("module_id, room_id")
        .eq("user_id", userId)
        .maybeSingle();
    if (!ticket) return { status: "idle" };

    if (!ticket.room_id) {
        const { count } = await admin
            .from("matchmaking_tickets")
            .select("user_id", { count: "exact", head: true })
            .eq("module_id", ticket.module_id)
            .is("room_id", null);
        return {
            status: "searching",
            moduleId: ticket.module_id,
            waiting: count ?? 1,
        };
    }

    // Matched: resolve the dealt game. A missing room (rolled-back formation) or
    // a not-yet-dealt game is a sub-second window — report "searching" so the
    // client holds rather than navigating nowhere.
    const { data: room } = await admin
        .from("rooms")
        .select("code, current_game_id")
        .eq("id", ticket.room_id)
        .maybeSingle();
    if (!room || !room.current_game_id) {
        return { status: "searching", moduleId: ticket.module_id, waiting: 1 };
    }
    return { status: "matched", gameId: room.current_game_id, code: room.code };
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
    const module = getGameModule(moduleId);
    if (!module) return { ok: false, error: "unknown_game" };
    if (module.maxPlayers <= 1) return { ok: false, error: "not_matchmakable" };

    const { error } = await admin.from("matchmaking_tickets").upsert(
        {
            user_id: userId,
            module_id: moduleId,
            room_id: null,
            created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );
    if (error) return { ok: false, error: "db_error", message: error.message };

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
    const module = getGameModule(moduleId);
    if (!module) return { ok: false, error: "unknown_game" };

    const roomId = crypto.randomUUID();
    const { data: claimed } = await admin
        .from("matchmaking_tickets")
        .update({ room_id: roomId })
        .eq("user_id", userId)
        .is("room_id", null)
        .select("user_id");

    // Losing the claim means either a human match grabbed the ticket first
    // (room_id set → honour it, never deal a second game; the not-yet-dealt
    // window reports "searching", so keep waiting) or the player never queued
    // (no ticket → fall through and deal solo+bots).
    if (!claimed || claimed.length === 0) {
        const { data: ticket } = await admin
            .from("matchmaking_tickets")
            .select("room_id")
            .eq("user_id", userId)
            .maybeSingle();
        if (ticket?.room_id) {
            const existing = await getMatchStatus(admin, userId);
            return existing.status === "matched"
                ? { ok: true, gameId: existing.gameId }
                : { ok: false, error: "match_in_progress" };
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
            await admin
                .from("matchmaking_tickets")
                .update({ room_id: null })
                .eq("user_id", userId);
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
    await admin
        .from("matchmaking_tickets")
        .delete()
        .eq("user_id", userId)
        .is("room_id", null);
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
    await admin.from("matchmaking_tickets").delete().eq("user_id", userId);
    return { ok: true };
}
