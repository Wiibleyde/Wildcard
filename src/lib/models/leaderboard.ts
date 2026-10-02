import { gameCatalog, getGameModule } from "@/lib/games";
import { ecaNamesByModuleIds } from "@/lib/games/resolve";
import { fallbackName } from "@/lib/models/identities";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const LEADERBOARD_TOP_N = 50;

export interface LeaderboardEntry {
    readonly userId: string;
    readonly username: string;
    /** Portal avatar path — see `portalAvatarUrl`. */
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
 * Per-game top `topN` by ELO, ranked in SQL (`leaderboard`). Throws on error so
 * a failure never renders as "no rated games yet".
 */
export async function getLeaderboard(
    supabase: ServerClient,
    topN: number = LEADERBOARD_TOP_N,
): Promise<LeaderboardGame[]> {
    const { data, error } = await supabase.rpc("leaderboard", {
        p_top_n: topN,
    });
    if (error) throw new Error(`getLeaderboard failed: ${error.message}`);

    // Rows arrive ordered by module, then rank.
    const byModule = new Map<string, LeaderboardEntry[]>();
    for (const row of data) {
        const list = byModule.get(row.module_id) ?? [];
        byModule.set(row.module_id, list);
        list.push({
            userId: row.user_id,
            username: row.username ?? fallbackName(row.user_id),
            avatarPath: row.avatar_url,
            rating: row.rating,
            gamesPlayed: row.games_played,
            wins: row.wins,
        });
    }

    // Catalog order first, then other modules (studio games) alphabetically.
    const catalogOrder = new Map(
        gameCatalog().map((g, index) => [g.id, index] as const),
    );
    const rank = (id: string) =>
        catalogOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
    const ecaNames = await ecaNamesByModuleIds(supabase, byModule.keys());

    return [...byModule.entries()]
        .map(([moduleId, entries]) => ({
            moduleId,
            moduleName:
                getGameModule(moduleId)?.name ??
                ecaNames.get(moduleId) ??
                moduleId,
            entries,
        }))
        .sort(
            (a, b) =>
                rank(a.moduleId) - rank(b.moduleId) ||
                a.moduleName.localeCompare(b.moduleName),
        );
}
