import { gameCatalog, getGameModule } from "@/lib/games";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** How many ranked players to surface per game. */
export const LEADERBOARD_TOP_N = 50;

export interface LeaderboardEntry {
    readonly userId: string;
    readonly username: string;
    /** Raw `profiles.avatar_url` path (bucket-relative), or null. */
    readonly avatarPath: string | null;
    readonly rating: number;
    readonly gamesPlayed: number;
    readonly wins: number;
}

export interface LeaderboardGame {
    readonly moduleId: string;
    readonly moduleName: string;
    readonly entries: readonly LeaderboardEntry[];
}

/**
 * Per-game ELO standings, best rating first. Delegates ranking to the
 * `leaderboard` SQL function, which uses a window function over the publicly
 * readable `player_elo` rows (RLS allows SELECT to everyone) joined to
 * `profiles` for the display name + avatar, and returns only the top `topN` per
 * module — the whole table never crosses the wire. Ratings are written
 * server-side from each game's `outcome()` (see {@link recordEloForGame}); this
 * is a pure read-only projection — the browser can never forge a rating here.
 *
 * Rows arrive ordered by module then in-module rank, so the per-module top
 * players are already in display order. Games appear in catalog order; a game
 * with no rated player yet is simply absent.
 *
 * A query failure is thrown, not swallowed: an error and "no rated games yet"
 * must never render as the same empty board.
 */
export async function getLeaderboard(
    supabase: ServerClient,
    topN: number = LEADERBOARD_TOP_N,
): Promise<LeaderboardGame[]> {
    const { data, error } = await supabase.rpc("leaderboard", {
        p_top_n: topN,
    });

    if (error) {
        throw new Error(`getLeaderboard failed: ${error.message}`);
    }

    const byModule = new Map<string, LeaderboardEntry[]>();
    for (const row of data ?? []) {
        const list = byModule.get(row.module_id) ?? [];
        byModule.set(row.module_id, list);
        list.push({
            userId: row.user_id,
            username: row.username,
            avatarPath: row.avatar_url,
            rating: row.rating,
            gamesPlayed: row.games_played,
            wins: row.wins,
        });
    }

    // Stable display order: native games as listed in the catalog, then any
    // other module that has ratings (e.g. a future ECA game), alphabetically.
    const catalogOrder = new Map(
        gameCatalog().map((g, index) => [g.id, index] as const),
    );
    const rank = (id: string) =>
        catalogOrder.get(id) ?? Number.MAX_SAFE_INTEGER;

    return [...byModule.entries()]
        .map(([moduleId, entries]) => ({
            moduleId,
            moduleName: getGameModule(moduleId)?.name ?? moduleId,
            entries,
        }))
        .sort(
            (a, b) =>
                rank(a.moduleId) - rank(b.moduleId) ||
                a.moduleName.localeCompare(b.moduleName),
        );
}
