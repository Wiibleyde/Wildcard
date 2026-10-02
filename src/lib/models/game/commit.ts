import type {
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
} from "@/lib/engine/types";
import { toJson, toJsonArray } from "@/lib/json";
import { notifyGameVersion } from "@/lib/realtime/notifyGameVersion";
import type { AdminClient } from "@/lib/supabase/admin";

export type CommitResult =
    | { ok: true; version: number }
    | { ok: false; error: "version_conflict" | "db_error"; message?: string };

/**
 * Version compare-and-set, secret state and log row (`seq` = new version) in
 * one transaction (`wildcard.commit_game_step`): a game can never be torn.
 */
export async function commitStep(
    admin: AdminClient,
    gameId: string,
    expectedVersion: number,
    state: GameState,
    isOver: boolean,
    outcome: GameOutcome | null,
    actorId: string,
    action: GameAction,
    events: readonly GameEvent[],
): Promise<CommitResult> {
    const { data, error } = await admin.rpc("commit_game_step", {
        p_game_id: gameId,
        p_expected_version: expectedVersion,
        p_phase: state.phase,
        p_current_player_id: state.currentPlayerId,
        p_is_over: isOver,
        p_winner_ids: [...(outcome?.winners ?? [])],
        p_state: toJson(state),
        p_actor_id: actorId,
        p_action: toJson(action),
        p_events: toJsonArray(events),
    });
    if (error) return { ok: false, error: "db_error", message: error.message };
    if (data === null) return { ok: false, error: "version_conflict" };
    // Not awaited: the doorbell must not pace the caller; clients' heartbeat covers a miss.
    void notifyGameVersion(admin, gameId, data);
    return { ok: true, version: data };
}
