import type { Player } from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import { ecaNamesByModuleIds } from "@/lib/games/resolve";
import { fromJson } from "@/lib/json";
import type { AdminClient } from "@/lib/supabase/admin";

export interface MatchPlayer {
    readonly id: string;
    readonly name: string;
    readonly isBot: boolean;
    readonly isWinner: boolean;
    readonly isYou: boolean;
}

/** `none` = no winner recorded. */
export type MatchResult = "win" | "loss" | "none";

export interface MatchHistoryEntry {
    readonly gameId: string;
    readonly moduleId: string;
    readonly moduleName: string;
    readonly playedAt: string;
    readonly result: MatchResult;
    /** Seating order. */
    readonly players: readonly MatchPlayer[];
    /** Move log pruned: nothing left to replay (mirrors `ReplayPayload.expired`). */
    readonly expired: boolean;
    readonly persistent: boolean;
}

const HISTORY_LIMIT = 100;

/**
 * Finished games the user sat in, newest first, via the `match_history`
 * function (service-role only: it reads the secret state). Participation comes
 * from `state.players`, which survives the player leaving the room.
 */
export async function getMatchHistory(
    admin: AdminClient,
    userId: string,
): Promise<MatchHistoryEntry[]> {
    const { data, error } = await admin.rpc("match_history", {
        p_user_id: userId,
        p_limit: HISTORY_LIMIT,
    });
    if (error) throw new Error(`getMatchHistory failed: ${error.message}`);
    if (data.length === 0) return [];

    const ecaNames = await ecaNamesByModuleIds(
        admin,
        data.map((row) => row.module_id),
    );

    return data.map((row) => {
        const winners = new Set(row.winner_ids);
        const bots = new Set(row.bot_ids);
        const seats = [...(fromJson<Player[] | null>(row.players) ?? [])].sort(
            (a, b) => a.seat - b.seat,
        );

        // A winnerless solo game (resigned Solitaire) is a loss.
        const result: MatchResult = winners.has(userId)
            ? "win"
            : winners.size > 0 || seats.length === 1
              ? "loss"
              : "none";

        return {
            gameId: row.game_id,
            moduleId: row.module_id,
            moduleName:
                getGameModule(row.module_id)?.name ??
                ecaNames.get(row.module_id) ??
                row.module_id,
            playedAt: row.created_at,
            result,
            expired: row.version > 0 && !row.has_moves,
            persistent: row.pinned,
            players: seats.map((p) => ({
                id: p.id,
                name: p.name,
                isBot: bots.has(p.id),
                isWinner: winners.has(p.id),
                isYou: p.id === userId,
            })),
        };
    });
}
