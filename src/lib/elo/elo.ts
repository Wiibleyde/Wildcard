/**
 * Rank-based multiplayer ELO: a final ranking of N players is scored as
 * N·(N−1)/2 head-to-head results, each player's surprises summed and scaled
 * by K/(N−1) so a swing stays comparable to a two-player game. Pure.
 */

export const DEFAULT_ELO = 1000;

/** Standard chess K-factor. */
export const DEFAULT_K = 32;

/** A 400-point gap ⇒ 10× expected-score odds. */
const ELO_SCALE = 400;

export interface EloParticipant {
    readonly playerId: string;
    readonly rating: number;
    /** 1 = best; ties share a rank. */
    readonly rank: number;
}

export interface EloUpdate {
    readonly playerId: string;
    readonly before: number;
    readonly after: number;
    /** `after = max(0, before + delta)`. */
    readonly delta: number;
}

function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + 10 ** ((ratingB - ratingA) / ELO_SCALE));
}

function actualScore(rankA: number, rankB: number): number {
    if (rankA < rankB) return 1;
    if (rankA > rankB) return 0;
    return 0.5;
}

/** Rated players only (the caller filters bots); fewer than two yields nothing. */
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
