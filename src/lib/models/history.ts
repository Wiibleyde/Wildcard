import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/** One seat as it appears in a finished game's history row. */
export interface MatchPlayer {
    readonly id: string;
    readonly name: string;
    readonly isBot: boolean;
    readonly isWinner: boolean;
    /** True for the viewer this history was built for. */
    readonly isYou: boolean;
}

/** The viewer's result in a finished game. `none` = no winner recorded. */
export type MatchResult = "win" | "loss" | "none";

/** A single finished game in a player's history. */
export interface MatchHistoryEntry {
    readonly gameId: string;
    readonly moduleId: string;
    /** Display name of the game module, falling back to its id. */
    readonly moduleName: string;
    /** ISO timestamp the game was created. */
    readonly playedAt: string;
    readonly result: MatchResult;
    /** Every seat, in seating order. */
    readonly players: readonly MatchPlayer[];
    /**
     * True once the move log has been pruned by the 15-day sweep — the durable
     * result survives, but there is nothing left to replay (button disabled).
     * Mirrors `ReplayPayload.expired` so the list and the replay page agree.
     */
    readonly expired: boolean;
    /** True when the viewer has pinned this game to keep its replay forever. */
    readonly persistent: boolean;
}

/** Cap on how many finished games we load — most recent first. */
const HISTORY_LIMIT = 100;

/**
 * A player's match history: every finished game they sat in, newest first.
 *
 * Backed by the `match_history(user, limit)` SQL function (one indexed query)
 * rather than a fan-out of reads. It joins `games` + `game_states`, filters to
 * the viewer's finished games, orders by date and caps at `p_limit` in the
 * database, and folds replay-availability (`has_moves`) and pin status
 * (`pinned`) per row — so we never stream every move row to Node or build an
 * unbounded `IN` list.
 *
 * Participation is read from the authoritative engine state, not from
 * `room_players` — that seat is deleted when a player leaves the room, so it
 * cannot reconstruct who played a past game. `game_states.state.players` is
 * stamped at deal time and never mutated, so it survives the player leaving and
 * even the room being reused.
 *
 * Must run with the service-role `admin` client: the function is SECURITY
 * DEFINER (it reads the RLS-denied secret state) and its EXECUTE is revoked from
 * every client role, so only the server may ask for a given user's history. We
 * only ever surface the public-safe `players` projection out of it here.
 */
export async function getMatchHistory(
    admin: Admin,
    userId: string,
): Promise<MatchHistoryEntry[]> {
    const { data } = await admin.rpc("match_history", {
        p_user_id: userId,
        p_limit: HISTORY_LIMIT,
    });
    if (!data || data.length === 0) return [];

    return data.map((row) => {
        const winners = new Set(row.winner_ids);
        const bots = new Set(row.bot_ids);
        const seats = [...((row.players ?? []) as unknown as Player[])].sort(
            (a, b) => a.seat - b.seat,
        );

        const won = winners.has(userId);
        const result: MatchResult = won
            ? "win"
            : winners.size > 0
              ? "loss"
              : "none";

        return {
            gameId: row.game_id,
            moduleId: row.module_id,
            moduleName: getGameModule(row.module_id)?.name ?? row.module_id,
            playedAt: row.created_at,
            result,
            // Mirrors getReplay's rule: a finished game that bumped its version
            // but has no surviving moves was pruned by the 15-day sweep.
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
