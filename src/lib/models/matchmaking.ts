import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameModule } from "@/lib/games";
import type { Database } from "@/lib/supabase/types";
import { makeCode, startGame } from "./room";

type Admin = SupabaseClient<Database>;

export type MatchErrorCode = "unknown_game" | "not_matchmakable" | "db_error";

/** HTTP status for each matchmaking error — keeps route handlers thin. */
export const MATCH_ERROR_STATUS: Record<MatchErrorCode, number> = {
    unknown_game: 400,
    not_matchmakable: 400,
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
    let created = false;
    let code = "";
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
        code = makeCode();
        const { error } = await admin.from("rooms").insert({
            id: roomId,
            code,
            module_id: moduleId,
            host_id: userIds[0],
            visibility,
            bot_count: botCount,
        });
        if (!error) {
            created = true;
            break;
        }
        if (error.code === "23505") continue; // code collision — new code, same id
        return { ok: false, message: error.message };
    }
    if (!created) return { ok: false, message: "code clash" };

    const seats = userIds.map((id, i) => ({
        room_id: roomId,
        user_id: id,
        seat: i,
        role: "player" as const,
    }));
    const { error: seatErr } = await admin.from("room_players").insert(seats);
    if (seatErr) return { ok: false, message: seatErr.message };

    // The matcher seats the earliest ticket as host; startGame gates on that.
    const started = await startGame(admin, userIds[0], code);
    if (!started.ok) {
        return { ok: false, message: started.message ?? started.error };
    }
    return { ok: true, gameId: started.gameId };
}

/**
 * Attempt to form one game from the waiting pool. The atomic `match_make` RPC
 * (FOR UPDATE SKIP LOCKED) either hands back a claimed group bound to a fresh
 * room id, or nothing when fewer than `min` are ready. On a formation failure
 * we release the claim so those players fall back into the queue.
 */
async function tryForm(
    admin: Admin,
    moduleId: string,
    min: number,
    max: number,
): Promise<void> {
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
    if (!res.ok) {
        await admin
            .from("matchmaking_tickets")
            .update({ room_id: null })
            .in("user_id", userIds);
    }
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

    await tryForm(admin, moduleId, module.minPlayers, module.maxPlayers);

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

    // Lost the claim → either already matched (honour it) or never queued
    // (fine, deal a fresh solo+bots room with the id we generated).
    if (!claimed || claimed.length === 0) {
        const existing = await getMatchStatus(admin, userId);
        if (existing.status === "matched") {
            return { ok: true, gameId: existing.gameId };
        }
    }

    const botCount = Math.max(0, module.minPlayers - 1);
    const res = await seatAndStart(
        admin,
        roomId,
        moduleId,
        [userId],
        "private",
        botCount,
    );
    if (!res.ok) return { ok: false, error: "db_error", message: res.message };
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
