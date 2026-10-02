import { type AnyGameModule, resolveRuleToggles } from "@/lib/engine/types";
import {
    resolveGameModule,
    resolveLaunchableModule,
} from "@/lib/games/resolve";
import type { AdminClient } from "@/lib/supabase/admin";
import { ROOM_NOT_IN_LOBBY, UNIQUE_VIOLATION } from "@/lib/supabase/pgErrors";
import { dealGame, nextFreeSeat } from "./game/deal";
import { forfeitGame } from "./game/settle";
import { makeCode, normalizeRoomCode } from "./roomCode";

export type RoomErrorCode =
    | "unknown_game"
    | "not_found"
    | "room_full"
    | "already_started"
    | "not_host"
    | "not_enough_players"
    | "deal_failed"
    | "invalid_bot_count"
    | "version_conflict"
    | "db_error";

type Result<T> =
    | ({ ok: true } & T)
    | { ok: false; error: RoomErrorCode; message?: string };

export const ROOM_ERROR_STATUS: Record<RoomErrorCode, number> = {
    unknown_game: 400,
    not_found: 404,
    room_full: 409,
    already_started: 409,
    not_host: 403,
    not_enough_players: 400,
    deal_failed: 500,
    invalid_bot_count: 400,
    version_conflict: 409,
    db_error: 500,
};

type RoomRole = "player" | "spectator";

const CODE_ATTEMPTS = 5;
const SEAT_ATTEMPTS = 3;

/** Insert a `rooms` row, retrying invite-code collisions. `id` is pre-allocated by the matchmaker. */
export async function insertRoom(
    admin: AdminClient,
    params: {
        moduleId: string;
        hostId: string;
        visibility: "public" | "private";
        id?: string;
        botCount?: number;
    },
): Promise<Result<{ roomId: string; code: string }>> {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        const code = makeCode();
        const { data, error } = await admin
            .from("rooms")
            .insert({
                ...(params.id ? { id: params.id } : {}),
                code,
                module_id: params.moduleId,
                host_id: params.hostId,
                visibility: params.visibility,
                ...(params.botCount !== undefined
                    ? { bot_count: params.botCount }
                    : {}),
            })
            .select("id")
            .single();
        if (!error) return { ok: true, roomId: data.id, code };
        if (error.code === UNIQUE_VIOLATION) continue;
        return { ok: false, error: "db_error", message: error.message };
    }
    return { ok: false, error: "db_error", message: "code clash" };
}

interface Lobby {
    readonly id: string;
    readonly module_id: string;
    readonly host_id: string;
    readonly bot_count: number;
    readonly rules: Record<string, boolean>;
}

/** A room still in the lobby, its module, and (with `hostId`) proof the caller hosts it. */
async function loadLobby(
    admin: AdminClient,
    code: string,
    options: { hostId?: string } = {},
): Promise<Result<{ room: Lobby; module: AnyGameModule }>> {
    const { data: room, error } = await admin
        .from("rooms")
        .select("id, module_id, host_id, status, bot_count, rules")
        .eq("code", normalizeRoomCode(code))
        .maybeSingle();
    if (error) return { ok: false, error: "db_error", message: error.message };
    if (!room) return { ok: false, error: "not_found" };
    if (options.hostId !== undefined && room.host_id !== options.hostId) {
        return { ok: false, error: "not_host" };
    }
    if (room.status !== "lobby") return { ok: false, error: "already_started" };

    const module = await resolveGameModule(admin, room.module_id);
    if (!module) return { ok: false, error: "unknown_game" };
    return { ok: true, room, module };
}

export async function createRoom(
    admin: AdminClient,
    hostId: string,
    moduleId: string,
    visibility: "public" | "private" = "private",
): Promise<Result<{ code: string; roomId: string }>> {
    // Studio games: published, or the host's own draft (playtest).
    if (!(await resolveLaunchableModule(admin, moduleId, hostId))) {
        return { ok: false, error: "unknown_game" };
    }

    const room = await insertRoom(admin, { moduleId, hostId, visibility });
    if (!room.ok) return room;

    const { error: seatError } = await admin
        .from("room_players")
        .insert({ room_id: room.roomId, user_id: hostId, seat: 0 });
    if (seatError) {
        await admin.from("rooms").delete().eq("id", room.roomId);
        return { ok: false, error: "db_error", message: seatError.message };
    }

    return { ok: true, code: room.code, roomId: room.roomId };
}

function seatWriteFailure(error: {
    code: string;
    message: string;
}): Result<never> {
    if (error.code === ROOM_NOT_IN_LOBBY) {
        return { ok: false, error: "already_started" };
    }
    return { ok: false, error: "db_error", message: error.message };
}

/**
 * Take the lowest free player seat, retrying the seat race (a unique
 * violation re-reads the seats instead of reporting a full room).
 * `join` admits a newcomer (as a spectator when the table is full);
 * `promote` only turns an existing member into a player.
 */
async function claimSeat(
    admin: AdminClient,
    roomId: string,
    userId: string,
    maxPlayers: number,
    mode: "join" | "promote",
): Promise<Result<{ role: RoomRole }>> {
    for (let attempt = 0; attempt < SEAT_ATTEMPTS; attempt++) {
        const { data: members, error: readError } = await admin
            .from("room_players")
            .select("user_id, seat, role")
            .eq("room_id", roomId);
        if (readError) {
            return { ok: false, error: "db_error", message: readError.message };
        }

        const me = members.find((s) => s.user_id === userId);
        if (mode === "join" && me) return { ok: true, role: me.role };
        if (mode === "promote") {
            if (!me) return { ok: false, error: "not_found" };
            if (me.role === "player") return { ok: true, role: "player" };
        }

        const playerSeats = members
            .filter((s) => s.role === "player")
            .map((s) => s.seat)
            .filter((n): n is number => n !== null);

        if (playerSeats.length >= maxPlayers) {
            if (mode === "promote") return { ok: false, error: "room_full" };
            // Full table: watch instead (a solo game is full once the host sits).
            const { error } = await admin.from("room_players").insert({
                room_id: roomId,
                user_id: userId,
                seat: null,
                role: "spectator",
            });
            if (!error || error.code === UNIQUE_VIOLATION) {
                return { ok: true, role: "spectator" };
            }
            return seatWriteFailure(error);
        }

        const seat = nextFreeSeat(playerSeats);
        if (mode === "join") {
            const { error } = await admin
                .from("room_players")
                .insert({ room_id: roomId, user_id: userId, seat });
            if (!error) return { ok: true, role: "player" };
            if (error.code !== UNIQUE_VIOLATION) return seatWriteFailure(error);
        } else {
            const { data: updated, error } = await admin
                .from("room_players")
                .update({ seat, role: "player" })
                .eq("room_id", roomId)
                .eq("user_id", userId)
                .select("user_id");
            if (!error) {
                return updated.length > 0
                    ? { ok: true, role: "player" }
                    : { ok: false, error: "not_found" };
            }
            if (error.code !== UNIQUE_VIOLATION) return seatWriteFailure(error);
        }
    }
    return { ok: false, error: "room_full" };
}

/** Idempotent if already in. */
export async function joinRoom(
    admin: AdminClient,
    userId: string,
    code: string,
): Promise<Result<{ roomId: string }>> {
    const lobby = await loadLobby(admin, code);
    if (!lobby.ok) return lobby;
    const seated = await claimSeat(
        admin,
        lobby.room.id,
        userId,
        lobby.module.maxPlayers,
        "join",
    );
    if (!seated.ok) return seated;
    return { ok: true, roomId: lobby.room.id };
}

/**
 * Switch an existing lobby member between player and spectator. Never admits
 * a newcomer: joining goes through {@link joinRoom} and its throttle.
 */
export async function setRoomRole(
    admin: AdminClient,
    userId: string,
    code: string,
    role: RoomRole,
): Promise<Result<{ role: RoomRole }>> {
    const lobby = await loadLobby(admin, code);
    if (!lobby.ok) return lobby;

    if (role === "player") {
        return claimSeat(
            admin,
            lobby.room.id,
            userId,
            lobby.module.maxPlayers,
            "promote",
        );
    }

    const { data: updated, error } = await admin
        .from("room_players")
        .update({ seat: null, role: "spectator" })
        .eq("room_id", lobby.room.id)
        .eq("user_id", userId)
        .select("user_id");
    if (error) return seatWriteFailure(error);
    if (updated.length === 0) return { ok: false, error: "not_found" };
    return { ok: true, role: "spectator" };
}

/**
 * Leaving a live game a player was dealt into is a forfeit, run before the
 * seat is removed so a failed forfeit leaves them seated to retry. Empty
 * lobbies are deleted; played rooms are kept (match history hangs off them).
 */
export async function leaveRoom(
    admin: AdminClient,
    userId: string,
    code: string,
): Promise<Result<object>> {
    const { data: room, error: roomError } = await admin
        .from("rooms")
        .select("id, host_id, status, current_game_id")
        .eq("code", normalizeRoomCode(code))
        .maybeSingle();
    if (roomError) {
        return { ok: false, error: "db_error", message: roomError.message };
    }
    if (!room) return { ok: false, error: "not_found" };

    if (room.status === "playing" && room.current_game_id) {
        const forfeit = await forfeitGame(admin, room.current_game_id, userId);
        if (!forfeit.ok && forfeit.error !== "not_found") {
            return forfeit.error === "version_conflict"
                ? { ok: false, error: "version_conflict" }
                : {
                      ok: false,
                      error: "db_error",
                      message: `forfeit failed: ${forfeit.error}`,
                  };
        }
    }

    const { error: deleteError } = await admin
        .from("room_players")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", userId);
    if (deleteError) {
        return { ok: false, error: "db_error", message: deleteError.message };
    }

    const { data: remaining, error: remainingError } = await admin
        .from("room_players")
        .select("user_id, seat")
        .eq("room_id", room.id)
        .order("seat", { ascending: true });
    if (remainingError) {
        return {
            ok: false,
            error: "db_error",
            message: remainingError.message,
        };
    }

    if (remaining.length === 0) {
        if (room.status === "lobby") {
            const { error } = await admin
                .from("rooms")
                .delete()
                .eq("id", room.id);
            if (error) {
                return { ok: false, error: "db_error", message: error.message };
            }
        }
        return { ok: true };
    }

    if (room.host_id === userId) {
        const { error } = await admin
            .from("rooms")
            .update({ host_id: remaining[0].user_id })
            .eq("id", room.id);
        if (error) {
            return { ok: false, error: "db_error", message: error.message };
        }
    }

    return { ok: true };
}

/** Host-only. Bots are materialised at deal time; this only records the count. */
export async function setBotCount(
    admin: AdminClient,
    userId: string,
    code: string,
    count: number,
): Promise<Result<{ botCount: number }>> {
    if (!Number.isInteger(count) || count < 0) {
        return { ok: false, error: "invalid_bot_count" };
    }

    const lobby = await loadLobby(admin, code, { hostId: userId });
    if (!lobby.ok) return lobby;
    const { room, module } = lobby;

    const { count: humanCount, error: countError } = await admin
        .from("room_players")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("role", "player");
    if (countError) {
        return { ok: false, error: "db_error", message: countError.message };
    }
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

/** Host-only. Stored already resolved against the game's toggles. */
export async function setRules(
    admin: AdminClient,
    userId: string,
    code: string,
    rules: Record<string, unknown>,
): Promise<Result<{ rules: Record<string, boolean> }>> {
    const lobby = await loadLobby(admin, code, { hostId: userId });
    if (!lobby.ok) return lobby;

    const resolved = resolveRuleToggles(lobby.module.ruleToggles, rules);
    const { error } = await admin
        .from("rooms")
        .update({ rules: resolved })
        .eq("id", lobby.room.id);
    if (error) return { ok: false, error: "db_error", message: error.message };

    return { ok: true, rules: resolved };
}

/** Host-only: claim the lobby, then deal (see `dealGame`). */
export async function startGame(
    admin: AdminClient,
    userId: string,
    code: string,
): Promise<Result<{ gameId: string }>> {
    const lobby = await loadLobby(admin, code, { hostId: userId });
    if (!lobby.ok) return lobby;
    const { room, module } = lobby;

    // Compare-and-set lobby → playing: a double start loses, and joins freeze.
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

    const dealt = await dealGame(admin, room, module);
    if (dealt.ok) return dealt;

    const { error: reopenError } = await admin
        .from("rooms")
        .update({ status: "lobby", current_game_id: null })
        .eq("id", room.id);
    if (reopenError) {
        return {
            ok: false,
            error: "db_error",
            message: `${dealt.error}; lobby not reopened: ${reopenError.message}`,
        };
    }
    return dealt;
}
