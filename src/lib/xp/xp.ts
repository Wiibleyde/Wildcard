/**
 * XP awards — playtime progression, distinct from ELO.
 *
 * XP only ever rises and is purely additive (no opponent rating, no zero-sum):
 * every human who finishes a game earns a flat participation grant, plus a bonus
 * if they placed first. Unlike ELO, a solo game against bots still earns XP —
 * XP rewards *playing*, not *winning against rated humans*.
 *
 * Pure and deterministic: the server derives awards from the engine outcome and
 * persists them; no DB or clock here.
 */

/** Flat XP for finishing a game, win or lose. */
export const PARTICIPATION_XP = 50;

/** Extra XP for placing first (rank 1, shared by ties). */
export const WIN_XP = 100;

/** XP needed to climb one level. A level is just `floor(xp / step) + 1`. */
export const XP_PER_LEVEL = 500;

/** Level for a total XP amount (level 1 starts at 0 XP). */
export function levelForXp(xp: number): number {
    return Math.floor(xp / XP_PER_LEVEL) + 1;
}

/** Fraction (0..1) filled toward the next level. */
export function xpProgress(xp: number): number {
    return (xp % XP_PER_LEVEL) / XP_PER_LEVEL;
}

export interface XpAward {
    readonly playerId: string;
    readonly amount: number;
}

/**
 * Compute each human participant's XP for one finished game. Bots (no profile,
 * no XP row) are filtered out by `botIds`. Returns one entry per rated human;
 * empty if everyone at the table was a bot.
 */
export function computeXpAwards(
    rankings: ReadonlyArray<{ readonly playerId: string }>,
    winners: readonly string[],
    botIds: readonly string[],
): XpAward[] {
    const botSet = new Set(botIds);
    const winSet = new Set(winners);

    const awards: XpAward[] = [];
    for (const { playerId } of rankings) {
        if (botSet.has(playerId)) continue;
        const amount = PARTICIPATION_XP + (winSet.has(playerId) ? WIN_XP : 0);
        awards.push({ playerId, amount });
    }
    return awards;
}
