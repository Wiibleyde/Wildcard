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

/**
 * Exponential level curve. Each level costs more than the last, so early levels
 * come quickly and later ones demand real playtime — the usual RPG feel.
 *
 * Cost to climb from level `L` to `L+1` is `BASE_XP * GROWTH^(L-1)`:
 *   1 → 2 : 300
 *   2 → 3 : 360
 *   3 → 4 : 432
 *   …
 * The *total* XP to reach level `L` is the geometric sum of those costs.
 */

/** XP cost of the first level-up (1 → 2); every later level scales from here. */
export const BASE_XP = 300;

/** Per-level cost multiplier. >1 makes the curve exponential. */
export const LEVEL_GROWTH = 1.2;

/**
 * Total XP required to *reach* `level` (level 1 sits at 0 XP).
 * Closed-form geometric sum of the per-level costs, rounded to whole XP so the
 * thresholds stay clean integers.
 */
export function xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round(
        (BASE_XP * (LEVEL_GROWTH ** (level - 1) - 1)) / (LEVEL_GROWTH - 1),
    );
}

/** Level for a total XP amount (level 1 starts at 0 XP). */
export function levelForXp(xp: number): number {
    if (xp <= 0) return 1;
    // Invert the geometric sum, then correct for float drift against the exact
    // (rounded) thresholds so boundaries land on the right level every time.
    const guess = Math.floor(
        Math.log((xp * (LEVEL_GROWTH - 1)) / BASE_XP + 1) /
            Math.log(LEVEL_GROWTH),
    );
    let level = Math.max(1, guess + 1);
    while (xpForLevel(level + 1) <= xp) level++;
    while (level > 1 && xpForLevel(level) > xp) level--;
    return level;
}

/** Fraction (0..1) filled toward the next level. */
export function xpProgress(xp: number): number {
    const level = levelForXp(xp);
    const floor = xpForLevel(level);
    const ceil = xpForLevel(level + 1);
    return (xp - floor) / (ceil - floor);
}

/** Level + progress breakdown for one total, for XP bar UIs. */
export function xpBreakdown(xp: number): {
    readonly level: number;
    readonly xpIntoLevel: number;
    readonly xpToNext: number;
    readonly progress: number;
} {
    const level = levelForXp(xp);
    const floor = xpForLevel(level);
    const ceil = xpForLevel(level + 1);
    return {
        level,
        xpIntoLevel: xp - floor,
        xpToNext: ceil - xp,
        progress: (xp - floor) / (ceil - floor),
    };
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
