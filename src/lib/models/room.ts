import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createGame } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import type { Database } from "@/lib/supabase/types";
import { advanceBots } from "./game";

type Admin = SupabaseClient<Database>;

export type RoomErrorCode =
    | "unknown_game"
    | "not_found"
    | "room_full"
    | "already_started"
    | "not_host"
    | "not_enough_players"
    | "invalid_bot_count"
    | "db_error";

type Result<T> =
    | ({ ok: true } & T)
    | { ok: false; error: RoomErrorCode; message?: string };

/** HTTP status for each room error — keeps the route handlers thin. */
export const ROOM_ERROR_STATUS: Record<RoomErrorCode, number> = {
    unknown_game: 400,
    not_found: 404,
    room_full: 409,
    already_started: 409,
    not_host: 403,
    not_enough_players: 400,
    invalid_bot_count: 400,
    db_error: 500,
};

/** Unambiguous alphabet — no 0/O, 1/I confusion in shared codes. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

function makeCode(): string {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    return out;
}

/** Smallest seat index not already occupied (fills gaps left by leavers). */
function nextFreeSeat(taken: readonly number[]): number {
    const used = new Set(taken);
    let seat = 0;
    while (used.has(seat)) seat++;
    return seat;
}

/**
 * Create a fresh lobby for `moduleId`, seating the host at seat 0. Retries on
 * the (rare) invite-code collision.
 */
export async function createRoom(
    admin: Admin,
    hostId: string,
    moduleId: string,
): Promise<Result<{ code: string; roomId: string }>> {
    if (!getGameModule(moduleId)) return { ok: false, error: "unknown_game" };

    let roomId: string | null = null;
    let code = "";
    for (let attempt = 0; attempt < 5 && !roomId; attempt++) {
        code = makeCode();
        const { data, error } = await admin
            .from("rooms")
            .insert({ code, module_id: moduleId, host_id: hostId })
            .select("id")
            .single();
        if (error) {
            if (error.code === "23505") continue; // code collision — retry
            return { ok: false, error: "db_error", message: error.message };
        }
        roomId = data.id;
    }
    if (!roomId) return { ok: false, error: "db_error", message: "code clash" };

    const { error: seatError } = await admin
        .from("room_players")
        .insert({ room_id: roomId, user_id: hostId, seat: 0 });
    if (seatError) {
        return { ok: false, error: "db_error", message: seatError.message };
    }

    return { ok: true, code, roomId };
}

/** Seat `userId` in the lobby with the given code. Idempotent if already in. */
export async function joinRoom(
    admin: Admin,
    userId: string,
    code: string,
): Promise<Result<{ roomId: string }>> {
    const { data: room } = await admin
        .from("rooms")
        .select("id, module_id, status")
        .eq("code", code.toUpperCase())
        .maybeSingle();
    if (!room) return { ok: false, error: "not_found" };
    if (room.status !== "lobby") return { ok: false, error: "already_started" };

    const module = getGameModule(room.module_id);
    if (!module) return { ok: false, error: "unknown_game" };

    // Retry loop: losing a seat race (unique violation) re-reads the seats and
    // tries the next free one instead of reporting a full room by mistake.
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data: seats } = await admin
            .from("room_players")
            .select("user_id, seat")
            .eq("room_id", room.id);
        const rows = seats ?? [];

        if (rows.some((s) => s.user_id === userId)) {
            return { ok: true, roomId: room.id }; // already seated
        }
        if (rows.length >= module.maxPlayers) {
            return { ok: false, error: "room_full" };
        }

        const seat = nextFreeSeat(rows.map((s) => s.seat));
        const { error } = await admin
            .from("room_players")
            .insert({ room_id: room.id, user_id: userId, seat });
        if (!error) return { ok: true, roomId: room.id };
        if (error.code !== "23505") {
            return { ok: false, error: "db_error", message: error.message };
        }
        // 23505 — someone claimed the seat (or we double-joined) → re-read.
    }

    return { ok: false, error: "room_full" };
}

/** Remove `userId` from the lobby; reassign host or delete the room if empty. */
export async function leaveRoom(
    admin: Admin,
    userId: string,
    code: string,
): Promise<
    { ok: true } | { ok: false; error: RoomErrorCode; message?: string }
> {
    const { data: room } = await admin
        .from("rooms")
        .select("id, host_id, status")
        .eq("code", code.toUpperCase())
        .maybeSingle();
    if (!room) return { ok: false, error: "not_found" };

    await admin
        .from("room_players")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", userId);

    const { data: remaining } = await admin
        .from("room_players")
        .select("user_id, seat")
        .eq("room_id", room.id)
        .order("seat", { ascending: true });

    if (!remaining || remaining.length === 0) {
        // Only reap empty LOBBIES. Played rooms stay: deleting them would
        // cascade into games/game_actions and erase the match history that
        // ELO and replays are built on.
        if (room.status === "lobby") {
            await admin.from("rooms").delete().eq("id", room.id);
        }
        return { ok: true };
    }

    if (room.host_id === userId) {
        await admin
            .from("rooms")
            .update({ host_id: remaining[0].user_id })
            .eq("id", room.id);
    }

    return { ok: true };
}

/**
 * Host-only: set how many computer players fill the lobby. Capped so the human
 * seats plus bots never exceed the game's max. Bots are materialised only at
 * deal time (see {@link startGame}); here we just record the count.
 */
export async function setBotCount(
    admin: Admin,
    userId: string,
    code: string,
    count: number,
): Promise<Result<{ botCount: number }>> {
    if (!Number.isInteger(count) || count < 0) {
        return { ok: false, error: "invalid_bot_count" };
    }

    const { data: room } = await admin
        .from("rooms")
        .select("id, module_id, host_id, status")
        .eq("code", code.toUpperCase())
        .maybeSingle();
    if (!room) return { ok: false, error: "not_found" };
    if (room.host_id !== userId) return { ok: false, error: "not_host" };
    if (room.status !== "lobby") return { ok: false, error: "already_started" };

    const module = getGameModule(room.module_id);
    if (!module) return { ok: false, error: "unknown_game" };

    const { count: humanCount } = await admin
        .from("room_players")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", room.id);

    if ((humanCount ?? 0) + count > module.maxPlayers) {
        return { ok: false, error: "invalid_bot_count" };
    }

    const { error } = await admin
        .from("rooms")
        .update({ bot_count: count })
        .eq("id", room.id);
    if (error) return { ok: false, error: "db_error", message: error.message };

    return { ok: true, botCount: count };
}

/**
 * Host-only: deal the game. Builds the engine `Player[]` from the human seats
 * plus `bot_count` synthetic computer players, runs `createGame` (random seed),
 * persists public meta + secret state, flips the room to `playing`, and lets any
 * bot who leads play immediately. Returns the new game id to navigate to.
 */
export async function startGame(
    admin: Admin,
    userId: string,
    code: string,
): Promise<Result<{ gameId: string }>> {
    const { data: room } = await admin
        .from("rooms")
        .select("id, module_id, host_id, status, bot_count")
        .eq("code", code.toUpperCase())
        .maybeSingle();
    if (!room) return { ok: false, error: "not_found" };
    if (room.host_id !== userId) return { ok: false, error: "not_host" };
    if (room.status !== "lobby") return { ok: false, error: "already_started" };

    const module = getGameModule(room.module_id);
    if (!module) return { ok: false, error: "unknown_game" };

    // Claim the room with a compare-and-set (lobby → playing). A concurrent
    // start (double-click, two tabs) loses the claim instead of dealing a
    // second game; it also freezes the seat list, since joins require
    // status = 'lobby'.
    const { data: claimed, error: claimError } = await admin
        .from("rooms")
        .update({ status: "playing" })
        .eq("id", room.id)
        .eq("status", "lobby")
        .select("id")
        .maybeSingle();
    if (claimError) {
        return { ok: false, error: "db_error", message: claimError.message };
    }
    if (!claimed) return { ok: false, error: "already_started" };

    /** Any failure past the claim re-opens the lobby before reporting. */
    const abort = async (
        error: RoomErrorCode,
        message?: string,
    ): Promise<Result<{ gameId: string }>> => {
        await admin
            .from("rooms")
            .update({ status: "lobby", current_game_id: null })
            .eq("id", room.id);
        return { ok: false, error, message };
    };

    const { data: seats } = await admin
        .from("room_players")
        .select("user_id, seat")
        .eq("room_id", room.id)
        .order("seat", { ascending: true });
    const rows = seats ?? [];

    const { data: profiles } = await admin
        .from("profiles")
        .select("id, username")
        .in(
            "id",
            rows.map((s) => s.user_id),
        );
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    const humans: Player[] = rows.map((s) => ({
        id: s.user_id,
        name: nameOf.get(s.user_id) ?? "Joueur",
        seat: s.seat,
    }));

    // Materialise bots as synthetic uuid players. Seats come from
    // nextFreeSeat — human seat numbers can have gaps after leavers, so
    // "humans.length + i" could collide with a real seat. Bots only fill up
    // to the game's max: a lobby that filled up after the host set the bot
    // count simply uses fewer computers.
    const takenSeats = rows.map((s) => s.seat);
    const botCount = Math.max(
        0,
        Math.min(room.bot_count, module.maxPlayers - humans.length),
    );
    const botIds: string[] = [];
    const bots: Player[] = [];
    for (let i = 0; i < botCount; i++) {
        const id = crypto.randomUUID();
        const seat = nextFreeSeat(takenSeats);
        takenSeats.push(seat);
        botIds.push(id);
        bots.push({ id, name: `Ordinateur ${i + 1}`, seat });
    }

    const players = [...humans, ...bots];
    if (
        players.length < module.minPlayers ||
        players.length > module.maxPlayers
    ) {
        return abort("not_enough_players");
    }

    let state: ReturnType<typeof createGame>;
    try {
        state = createGame(module, players);
    } catch (err) {
        return abort(
            "not_enough_players",
            err instanceof Error ? err.message : String(err),
        );
    }

    const { data: game, error: gameError } = await admin
        .from("games")
        .insert({
            room_id: room.id,
            module_id: room.module_id,
            phase: state.phase,
            current_player_id: state.currentPlayerId,
            is_over: module.isOver(state),
            version: 0,
            bot_ids: botIds,
        })
        .select("id")
        .single();
    if (gameError || !game) {
        return abort("db_error", gameError?.message);
    }

    const { error: stateError } = await admin.from("game_states").insert({
        game_id: game.id,
        state: state as unknown as Record<string, unknown>,
    });
    if (stateError) {
        // Roll back the orphan meta row so the room stays startable.
        await admin.from("games").delete().eq("id", game.id);
        return abort("db_error", stateError.message);
    }

    await admin
        .from("rooms")
        .update({ current_game_id: game.id })
        .eq("id", room.id);

    // If a bot leads (e.g. holds the 3♣ in Président), let it play — after the
    // response, paced, so every client sees the opening moves animate.
    if (botIds.length > 0) {
        after(() =>
            advanceBots(admin, game.id, room.id, module, state, 0, botIds),
        );
    }

    return { ok: true, gameId: game.id };
}
