/**
 * Multiplayer ELO — rank-based, pairwise.
 *
 * Classic two-player ELO compares one expected score against one actual result.
 * Card games here finish with a *ranking* of N players, so we generalise the
 * standard way: treat the final standing as N·(N−1)/2 implicit head-to-head
 * results. For each ordered pair (i, j) player i "beat" j (1), tied (0.5) or
 * "lost" to j (0) according to their final ranks; the expected score uses the
 * usual logistic on the rating gap. Each player's delta is the sum of their
 * pairwise surprises, scaled by K/(N−1) so the magnitude stays comparable to a
 * two-player game regardless of table size.
 *
 * Deterministic and pure: same inputs → same integer deltas. No DB, no clock —
 * the server fetches current ratings, calls this, and persists the deltas.
 */

/** Rating a player starts at before their first rated game on a module. */
export const DEFAULT_ELO = 1000;

/** Standard chess K-factor — the maximum single-pairing swing. */
export const DEFAULT_K = 32;

/** ELO's logistic scale: a 400-point gap ⇒ 10× expected-score odds. */
const ELO_SCALE = 400;

export interface EloParticipant {
    readonly playerId: string;
    /** Current rating going into this game. */
    readonly rating: number;
    /** Final rank: 1 = best, ties share a rank. */
    readonly rank: number;
}

export interface EloUpdate {
    readonly playerId: string;
    readonly before: number;
    readonly after: number;
    /** Signed rounded change; `after = max(0, before + delta)`. */
    readonly delta: number;
}

/** Expected score of A against B given the rating gap (0..1). */
function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + 10 ** ((ratingB - ratingA) / ELO_SCALE));
}

/** Actual pairwise score for A vs B from their ranks (lower rank = better). */
function actualScore(rankA: number, rankB: number): number {
    if (rankA < rankB) return 1;
    if (rankA > rankB) return 0;
    return 0.5;
}

/**
 * Compute every participant's rating change for one finished game.
 *
 * Requires at least two participants — a single player has no opponent to be
 * rated against and yields an empty result. Bots must be filtered out by the
 * caller before calling this: only rated players belong here.
 */
export function computeEloUpdates(
    participants: readonly EloParticipant[],
    k: number = DEFAULT_K,
): EloUpdate[] {
    const n = participants.length;
    if (n < 2) return [];

    return participants.map((player) => {
        let surprise = 0;
        for (const other of participants) {
            if (other.playerId === player.playerId) continue;
            const expected = expectedScore(player.rating, other.rating);
            const actual = actualScore(player.rank, other.rank);
            surprise += actual - expected;
        }
        const delta = Math.round((k / (n - 1)) * surprise);
        const after = Math.max(0, player.rating + delta);
        return {
            playerId: player.playerId,
            before: player.rating,
            after,
            delta: after - player.rating,
        };
    });
}
