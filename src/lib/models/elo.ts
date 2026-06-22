import type { SupabaseClient } from "@supabase/supabase-js";
import { computeEloUpdates, DEFAULT_ELO } from "@/lib/elo/elo";
import type { GameOutcome } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * Persist per-module ELO for one finished game — **server-only**.
 *
 * Called from the game-finish path (after the outcome is final and the room is
 * marked finished). Best-effort: rating is a derived stat, never on the
 * critical path of a move, so any failure here is swallowed rather than failing
 * the player's action.
 *
 * Only humans are rated. Bots have no `profiles` row and no rating, so they are
 * filtered out; a game must still leave **two or more humans** to move anyone's
 * rating — you cannot farm ELO against bots. Their relative ranks among each
 * other are what the pairwise model scores.
 */
export async function recordEloForGame(
    admin: Admin,
    moduleId: string,
    outcome: GameOutcome | null,
    botIds: readonly string[],
): Promise<void> {
    if (!outcome) return;

    const botSet = new Set(botIds);
    const humans = outcome.rankings.filter((r) => !botSet.has(r.playerId));
    if (humans.length < 2) return;

    try {
        // Current ratings; a player with no row yet starts at DEFAULT_ELO. The
        // SQL function recreates that same base when it inserts, so the delta
        // we compute here lands on the value we assumed.
        const ids = humans.map((h) => h.playerId);
        const { data: rows } = await admin
            .from("player_elo")
            .select("user_id, rating")
            .eq("module_id", moduleId)
            .in("user_id", ids);

        const ratingOf = new Map<string, number>(
            (rows ?? []).map((row) => [row.user_id, row.rating]),
        );

        const updates = computeEloUpdates(
            humans.map((h) => ({
                playerId: h.playerId,
                rank: h.rank,
                rating: ratingOf.get(h.playerId) ?? DEFAULT_ELO,
            })),
        );

        const winners = new Set(outcome.winners);
        const results = updates.map((u) => ({
            user_id: u.playerId,
            delta: u.delta,
            won: winners.has(u.playerId),
        }));

        await admin.rpc("apply_elo_results", {
            p_module_id: moduleId,
            p_results: results,
        });
    } catch {
        // Rating is best-effort — swallow so a stats hiccup never breaks play.
    }
}
