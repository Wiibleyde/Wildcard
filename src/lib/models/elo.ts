import type { SupabaseClient } from "@supabase/supabase-js";
import { computeEloUpdates, DEFAULT_ELO } from "@/lib/elo/elo";
import type { GameOutcome } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/** One participant's rating change, as `wildcard.settle_game` applies it. */
export interface EloResultRow {
    readonly user_id: string;
    readonly delta: number;
    readonly won: boolean;
}

/**
 * Compute the per-module ELO changes of one finished game — **server-only**.
 *
 * The rows are applied by `wildcard.settle_game` in the same transaction that
 * marks the game settled, so a game moves ratings exactly once even when its
 * settlement is retried (see `settleGame` in ./game.ts).
 *
 * Only humans are rated. Bots have no `profiles` row and no rating, so they are
 * filtered out; a game must still leave **two or more humans** to move anyone's
 * rating — you cannot farm ELO against bots. Their relative ranks among each
 * other are what the pairwise model scores.
 *
 * Best-effort: a failed ratings read is logged and yields no change (rating is
 * a derived stat, never worth failing a move over) — computing deltas from
 * guessed ratings would be worse than skipping them.
 */
export async function eloResultsForGame(
    admin: Admin,
    moduleId: string,
    outcome: GameOutcome | null,
    botIds: readonly string[],
): Promise<EloResultRow[]> {
    if (!outcome) return [];

    const botSet = new Set(botIds);
    const humans = outcome.rankings.filter((r) => !botSet.has(r.playerId));
    if (humans.length < 2) return [];

    // Current ratings; a player with no row yet starts at DEFAULT_ELO. The SQL
    // function recreates that same base when it inserts, so the delta computed
    // here lands on the value we assumed.
    const ids = humans.map((h) => h.playerId);
    const { data: rows, error } = await admin
        .from("player_elo")
        .select("user_id, rating")
        .eq("module_id", moduleId)
        .in("user_id", ids);
    if (error) {
        console.error(
            `[elo] ratings read failed (${moduleId}):`,
            error.message,
        );
        return [];
    }

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
    return updates.map((u) => ({
        user_id: u.playerId,
        delta: u.delta,
        won: winners.has(u.playerId),
    }));
}
