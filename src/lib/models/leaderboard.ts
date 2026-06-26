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
 * Per-game ELO standings, best rating first. Reads the publicly-readable
 * `player_elo` rows (RLS allows SELECT to everyone) joined to `profiles` for the
 * display name + avatar. Ratings are written server-side from each game's
 * `outcome()` (see {@link recordEloForGame}); this is a pure read-only
 * projection — the browser can never forge a rating here.
 *
 * Rows are returned already ordered by rating desc, so the first `topN` seen per
 * module are that game's top players. Games appear in catalog order; a game with
 * no rated player yet is simply absent.
 */
export async function getLeaderboard(
    supabase: ServerClient,
    topN: number = LEADERBOARD_TOP_N,
): Promise<LeaderboardGame[]> {
    const { data, error } = await supabase
        .from("player_elo")
        .select(
            "user_id, module_id, rating, games_played, wins, profiles(username, avatar_url)",
        )
        .order("rating", { ascending: false });

    if (error || !data) return [];

    const byModule = new Map<string, LeaderboardEntry[]>();
    for (const row of data) {
        // Embedded to-one relation; defensively handle the array shape supabase
        // sometimes infers, and skip rows whose profile was deleted.
        const profile = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles;
        if (!profile) continue;

        const list = byModule.get(row.module_id) ?? [];
        byModule.set(row.module_id, list);
        if (list.length >= topN) continue;
        list.push({
            userId: row.user_id,
            username: profile.username,
            avatarPath: profile.avatar_url,
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
