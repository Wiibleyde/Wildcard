import { after } from "next/server";
import { createGame, withGameRules } from "@/lib/engine/runner";
import {
    type AnyGameModule,
    type GameOutcome,
    type GameState,
    type Player,
    resolveRuleToggles,
} from "@/lib/engine/types";
import { toJson } from "@/lib/json";
import { recordGameStarted } from "@/lib/metrics/registry";
import { nameTag, usernamesByIds } from "@/lib/models/identities";
import type { AdminClient } from "@/lib/supabase/admin";
import { advanceBots } from "./bots";
import { settleGame } from "./settle";

export type DealErrorCode = "not_enough_players" | "deal_failed" | "db_error";

export interface DealRoom {
    readonly id: string;
    readonly module_id: string;
    readonly bot_count: number;
    readonly rules: Record<string, boolean>;
}

/** Smallest seat index not already occupied (fills gaps left by leavers). */
export function nextFreeSeat(taken: readonly number[]): number {
    const used = new Set(taken);
    let seat = 0;
    while (used.has(seat)) seat++;
    return seat;
}

/**
 * Deal a game in a room already claimed (`status = 'playing'`): seated players
 * plus `bot_count` computers, meta + state + room pointer written atomically by
 * `wildcard.create_game`. The caller re-opens the lobby on failure.
 */
export async function dealGame(
    admin: AdminClient,
    room: DealRoom,
    module: AnyGameModule,
): Promise<
    | { ok: true; gameId: string }
    | { ok: false; error: DealErrorCode; message?: string }
> {
    const { data: seats, error: seatsError } = await admin
        .from("room_players")
        .select("user_id, seat")
        .eq("room_id", room.id)
        .eq("role", "player")
        .order("seat", { ascending: true });
    if (seatsError) {
        return { ok: false, error: "db_error", message: seatsError.message };
    }
    const rows = seats.filter(
        (s): s is { user_id: string; seat: number } => s.seat !== null,
    );

    const nameOf = await usernamesByIds(
        admin,
        rows.map((s) => s.user_id),
    );
    // Names are frozen into the state, which every locale replays: store
    // locale-neutral fallbacks. Bot `n` = 1 + its index in `bot_ids`.
    const humans: Player[] = rows.map((s) => ({
        id: s.user_id,
        name: nameOf.get(s.user_id) ?? `#${nameTag(s.user_id)}`,
        seat: s.seat,
    }));

    // Seats from nextFreeSeat: human seats can have gaps after leavers.
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
        bots.push({ id, name: `Bot ${i + 1}`, seat });
    }

    const players = [...humans, ...bots];
    if (
        players.length < module.minPlayers ||
        players.length > module.maxPlayers
    ) {
        return { ok: false, error: "not_enough_players" };
    }

    const configured = withGameRules(
        module,
        resolveRuleToggles(module.ruleToggles, room.rules),
    );
    // Minted here so `games.id` and `state.gameId` match (replay re-derives with it).
    const gameId = crypto.randomUUID();
    let state: GameState;
    let overAtDeal: boolean;
    let dealOutcome: GameOutcome | null;
    try {
        state = createGame(configured, players, { gameId });
        // A studio game can end at deal time (turnStarted → endGame rule).
        overAtDeal = configured.isOver(state);
        dealOutcome = overAtDeal ? configured.outcome(state) : null;
    } catch (err) {
        return {
            ok: false,
            error: "deal_failed",
            message: err instanceof Error ? err.message : String(err),
        };
    }

    const { data: createdAt, error } = await admin.rpc("create_game", {
        p_game_id: gameId,
        p_room_id: room.id,
        p_module_id: room.module_id,
        p_phase: state.phase,
        p_current_player_id: state.currentPlayerId,
        p_is_over: overAtDeal,
        p_winner_ids: [...(dealOutcome?.winners ?? [])],
        p_bot_ids: botIds,
        p_state: toJson(state),
    });
    if (error) return { ok: false, error: "db_error", message: error.message };
    recordGameStarted(room.module_id);

    if (overAtDeal) {
        await settleGame(
            admin,
            {
                id: gameId,
                moduleId: room.module_id,
                botIds,
                createdAt,
                moveCount: 0,
            },
            dealOutcome,
        );
    } else if (botIds.length > 0) {
        const dealt = state;
        // A bot may lead (e.g. holds the 3♣ in Président).
        after(() =>
            advanceBots(admin, gameId, configured, dealt, 0, botIds, createdAt),
        );
    }

    return { ok: true, gameId };
}
