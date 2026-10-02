import {
    resolveGameModule,
    resolveLaunchableModule,
} from "@/lib/games/resolve";
import type { AdminClient } from "@/lib/supabase/admin";
import { insertRoom, type RoomErrorCode, startGame } from "./room";

export type MatchErrorCode =
    | "unknown_game"
    | "not_matchmakable"
    | "match_in_progress"
    | "deal_failed"
    | "db_error";

export const MATCH_ERROR_STATUS: Record<MatchErrorCode, number> = {
    unknown_game: 400,
    not_matchmakable: 400,
    match_in_progress: 409,
    deal_failed: 500,
    db_error: 500,
};

type Result<T> =
    | ({ ok: true } & T)
    | { ok: false; error: MatchErrorCode; message?: string };

export type MatchStatus =
    | { status: "idle" }
    | { status: "searching"; moduleId: string; waiting: number }
    | { status: "matched"; gameId: string; code: string };

/** Errors folded into a status still need a trace for operators. */
function logDbError(what: string, error: { message: string } | null): void {
    if (error) console.error(`[matchmaking] ${what} failed:`, error.message);
}

/**
 * Tickets are stamped with the room id before the room exists (sub-second
 * window). A missing room older than this is a formation that died half-way.
 */
const MISSING_ROOM_STALE_MS = 2 * 60_000;
const FORM_ATTEMPTS = 3;
const CLAIM_ATTEMPTS = 3;

type TicketRoom =
    | { kind: "live"; code: string; gameId: string | null }
    | { kind: "finished" }
    | { kind: "missing" }
    | { kind: "error"; message: string };

async function resolveTicketRoom(
    admin: AdminClient,
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
        // An admin force-end flips `games.is_over` before the room is finished.
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

/** A spent ticket must neither block a new search nor point back at an old game. */
function isSpent(room: TicketRoom, ticketCreatedAt: string): boolean {
    if (room.kind === "finished") return true;
    return (
        room.kind === "missing" &&
        Date.now() - new Date(ticketCreatedAt).getTime() >=
            MISSING_ROOM_STALE_MS
    );
}

/** Only if it still points at that same room. */
async function dropSpentTicket(
    admin: AdminClient,
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

function matchErrorOf(code: RoomErrorCode): MatchErrorCode {
    switch (code) {
        case "unknown_game":
            return "unknown_game";
        case "not_enough_players":
        case "invalid_bot_count":
            return "not_matchmakable";
        case "deal_failed":
            return "deal_failed";
        case "already_started":
        case "version_conflict":
            return "match_in_progress";
        default:
            return "db_error";
    }
}

/**
 * Turn a claimed group into a started game: room under the pre-allocated id,
 * seats in claim order (host first), then the shared {@link startGame}.
 */
async function seatAndStart(
    admin: AdminClient,
    roomId: string,
    moduleId: string,
    userIds: string[],
    visibility: "public" | "private",
    botCount: number,
): Promise<Result<{ gameId: string }>> {
    // FK order: seats before room.
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
    if (!room.ok) {
        return { ok: false, error: "db_error", message: room.message };
    }

    const { error: seatErr } = await admin.from("room_players").insert(
        userIds.map((id, i) => ({
            room_id: roomId,
            user_id: id,
            seat: i,
            role: "player" as const,
        })),
    );
    if (seatErr) {
        await teardown();
        return { ok: false, error: "db_error", message: seatErr.message };
    }

    const started = await startGame(admin, userIds[0], room.code);
    if (!started.ok) {
        await teardown();
        return {
            ok: false,
            error: matchErrorOf(started.error),
            message: started.message ?? started.error,
        };
    }
    return { ok: true, gameId: started.gameId };
}

/**
 * Form one game from the pool. `match_make` claims a group atomically
 * (FOR UPDATE SKIP LOCKED); a failed formation releases it and retries, then
 * leaves the group queued for the next enqueue.
 */
async function tryForm(
    admin: AdminClient,
    moduleId: string,
    min: number,
    max: number,
): Promise<void> {
    for (let attempt = 0; attempt < FORM_ATTEMPTS; attempt++) {
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
        console.error(
            `[matchmaking] formation failed (${res.error}):`,
            res.message,
        );

        const { error: releaseError } = await admin
            .from("matchmaking_tickets")
            .update({ room_id: null })
            .in("user_id", userIds)
            .eq("room_id", roomId);
        logDbError("release claimed group", releaseError);
    }
}

async function formFor(admin: AdminClient, moduleId: string): Promise<void> {
    // A pool already exists for this id, so resolve status-agnostic.
    const module = await resolveGameModule(admin, moduleId);
    if (!module || module.maxPlayers <= 1) return;
    await tryForm(admin, moduleId, module.minPlayers, module.maxPlayers);
}

/** A ticket whose game is over is dropped and reported `idle`. */
export async function getMatchStatus(
    admin: AdminClient,
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
    // Formation in flight: hold as "searching", never drop a match being dealt.
    if (room.kind !== "live" || !room.gameId) {
        return { status: "searching", moduleId: ticket.module_id, waiting: 1 };
    }
    return { status: "matched", gameId: room.gameId, code: room.code };
}

/**
 * Put the ticket in the searching state without clobbering a live match (a
 * blind upsert could seat a just-paired player in two games). Every write is a
 * compare-and-set on the `room_id` just read; a lost race re-reads.
 */
async function claimSearchingTicket(
    admin: AdminClient,
    userId: string,
    moduleId: string,
): Promise<Result<object>> {
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
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
            if (inserted.length > 0) return { ok: true };
            continue;
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
        if (updated.length > 0) return { ok: true };
    }
    return { ok: false, error: "match_in_progress" };
}

/** Join or refresh the queue, then try to form a game right away. */
export async function enqueue(
    admin: AdminClient,
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
 * Deal a private game filled with bots now. The ticket is pulled out of the
 * queue atomically first, so a human match landing at the same instant wins.
 */
export async function playWithBots(
    admin: AdminClient,
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

    // Lost the claim: honour a live match, recycle a spent one, or (no ticket) deal solo.
    if (claimed.length === 0) {
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
    // Defensive against min > max; a 1-seat game is fine here (solo deal).
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
    if (!res.ok && claimed.length > 0) {
        // The room was torn down: don't leave the ticket pointing at it.
        const { error: releaseError } = await admin
            .from("matchmaking_tickets")
            .update({ room_id: null })
            .eq("user_id", userId)
            .eq("room_id", roomId);
        logDbError("release bot claim", releaseError);
    }
    return res;
}

type TicketResult =
    | { ok: true }
    | { ok: false; error: "db_error"; message: string };

/** Drops only a still-searching ticket, never a matched one. */
export async function leaveQueue(
    admin: AdminClient,
    userId: string,
): Promise<TicketResult> {
    const { error } = await admin
        .from("matchmaking_tickets")
        .delete()
        .eq("user_id", userId)
        .is("room_id", null);
    if (error) return { ok: false, error: "db_error", message: error.message };
    return { ok: true };
}

/** Consume a match once the player walked into the game, so it stops pulling them back. */
export async function clearTicket(
    admin: AdminClient,
    userId: string,
): Promise<TicketResult> {
    const { error } = await admin
        .from("matchmaking_tickets")
        .delete()
        .eq("user_id", userId);
    if (error) return { ok: false, error: "db_error", message: error.message };
    return { ok: true };
}
