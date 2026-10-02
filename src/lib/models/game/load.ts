import { isEcaModuleId } from "@/lib/eca/id";
import type { EcaState } from "@/lib/eca/types";
import type { AnyGameModule, GameState } from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import { ecaModuleFromState } from "@/lib/games/resolve";
import { fromJson } from "@/lib/json";
import type { AdminClient } from "@/lib/supabase/admin";
import type { GameEndReason } from "@/lib/supabase/types";

export type LoadError = "not_found" | "unknown_game" | "db_error";

export interface GameMeta {
    readonly id: string;
    readonly room_id: string;
    readonly module_id: string;
    readonly version: number;
    readonly is_over: boolean;
    readonly current_player_id: string | null;
    readonly bot_ids: string[];
    readonly winner_ids: string[];
    readonly end_reason: GameEndReason | null;
    readonly forfeited_by: string | null;
    readonly actions_pruned_at: string | null;
    readonly created_at: string | null;
    readonly updated_at: string;
    readonly room_code: string | null;
}

export interface LoadedGame {
    readonly meta: GameMeta;
    readonly module: AnyGameModule;
    readonly state: GameState;
}

/** A PostgREST one-to-one embed comes back as an object or a one-element array. */
export function unwrapEmbed<T>(embed: T | T[] | null | undefined): T | null {
    return (Array.isArray(embed) ? embed[0] : embed) ?? null;
}

/**
 * Studio games rebuild from the definition stamped into the state: no
 * `eca_games` read, and the game survives later edits of its row. Returns
 * `undefined` when the module is gone or the stamped definition is unusable.
 */
export function moduleForState(
    moduleId: string,
    state: GameState,
): AnyGameModule | undefined {
    if (!isEcaModuleId(moduleId)) return getGameModule(moduleId);
    try {
        return ecaModuleFromState(state as EcaState, moduleId);
    } catch (err) {
        console.error(`[game] module rebuild failed (${moduleId}):`, err);
        return undefined;
    }
}

/**
 * Meta and secret state in one statement, so both come from the same snapshot
 * (`commit_game_step` writes them in one transaction).
 */
export async function loadGame(
    admin: AdminClient,
    gameId: string,
): Promise<{ ok: true; game: LoadedGame } | { ok: false; error: LoadError }> {
    const { data, error } = await admin
        .from("games")
        .select(
            "id, room_id, module_id, version, is_over, current_player_id, bot_ids, winner_ids, end_reason, forfeited_by, actions_pruned_at, created_at, updated_at, game_states(state), rooms!games_room_id_fkey(code)",
        )
        .eq("id", gameId)
        .maybeSingle();
    if (error) {
        console.error(`[game] load failed (${gameId}):`, error.message);
        return { ok: false, error: "db_error" };
    }
    if (!data) return { ok: false, error: "not_found" };

    const { game_states: stateEmbed, rooms: roomEmbed, ...row } = data;
    const secret = unwrapEmbed(
        fromJson<{ state: unknown } | { state: unknown }[] | null>(stateEmbed),
    );
    if (!secret) return { ok: false, error: "not_found" };
    const room = unwrapEmbed(
        fromJson<{ code: string } | { code: string }[] | null>(roomEmbed),
    );

    const state = fromJson<GameState>(secret.state);
    const module = moduleForState(row.module_id, state);
    if (!module) return { ok: false, error: "unknown_game" };

    return {
        ok: true,
        game: {
            meta: { ...row, room_code: room?.code ?? null },
            module,
            state,
        },
    };
}
