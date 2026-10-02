import { isEcaModuleId } from "@/lib/eca/id";

/**
 * XP awards — playtime progression, distinct from ELO.
 *
 * XP only ever rises and is purely additive (no opponent rating, no zero-sum):
 * every human who finishes a game earns a flat participation grant, plus a bonus
 * if they placed first, scaled by the game's length. Unlike ELO, a solo game
 * against bots still earns XP — XP rewards *playing*, not *winning against
 * rated humans* — but a bot-only win pays a reduced bonus.
 *
 * Pure and deterministic: the server derives awards from the engine outcome and
 * persists them; no DB or clock here.
 */

/** Flat XP for finishing a game, win or lose. */
export const PARTICIPATION_XP = 50;

/**
 * Win bonus per beaten seat. The bonus scales with the table: beating three
 * opponents at Président is worth more than beating one at Bataille, since the
 * odds of winning shrink as seats are added. A solo game (Solitaire) counts the
 * deck as one opponent.
 */
export const WIN_XP_PER_OPPONENT = 35;

/**
 * Win-bonus multiplier when no other human sat at the table (bots only, or a
 * solo game). Beating bots is still rewarded, but farming easy bot wins must
 * not outpace playing against people.
 */
export const BOT_ONLY_WIN_FACTOR = 0.5;

/**
 * Per-game XP weight, so a long game is not worth the same as a quick one —
 * otherwise players would farm the shortest game. Weights follow typical game
 * length (catalog `durationMin`) but sub-linearly, so short games still feel
 * rewarding. Président (~12 min) is the 1.0 reference.
 */
export const GAME_XP_WEIGHT: Readonly<Record<string, number>> = {
    bataille: 0.35,
    solitaire: 0.6,
    president: 1,
    tarot: 1.4,
};

/**
 * Weight for studio (ECA) games: their length is unknown and a creator could
 * publish a one-move game, so they sit below every native game.
 */
export const ECA_XP_WEIGHT = 0.5;

/** Weight for a native game missing from {@link GAME_XP_WEIGHT}. */
export const DEFAULT_XP_WEIGHT = 1;

/** XP weight of a game module (see {@link GAME_XP_WEIGHT}). */
export function xpWeightFor(moduleId: string): number {
    if (isEcaModuleId(moduleId)) return ECA_XP_WEIGHT;
    return GAME_XP_WEIGHT[moduleId] ?? DEFAULT_XP_WEIGHT;
}

/**
 * Polynomial level curve. Each level costs a bit more than the last, but the
 * cost grows sub-quadratically, so high levels stay reachable — an exponential
 * curve hits a wall around level 20 where one level costs hundreds of games.
 *
 * The *total* XP to reach level `L` is `BASE_XP * (L-1)^LEVEL_EXPONENT`:
 *   level  2 :    250
 *   level  3 :    758
 *   level  5 :  2 297
 *   level 10 :  8 409
 *   level 20 : 27 794
 */

/** Total XP to reach level 2; every later threshold scales from here. */
export const BASE_XP = 250;

/** Curve exponent. >1 makes each level cost more than the previous one. */
export const LEVEL_EXPONENT = 1.6;

/**
 * Total XP required to *reach* `level` (level 1 sits at 0 XP), rounded to
 * whole XP so the thresholds stay clean integers.
 */
export function xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round(BASE_XP * (level - 1) ** LEVEL_EXPONENT);
}

/** Level for a total XP amount (level 1 starts at 0 XP). */
export function levelForXp(xp: number): number {
    if (xp <= 0) return 1;
    // Invert the power law, then correct for float drift against the exact
    // (rounded) thresholds so boundaries land on the right level every time.
    const guess = Math.floor((xp / BASE_XP) ** (1 / LEVEL_EXPONENT));
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

export interface XpGameFacts {
    /** Module id — picks the game's XP weight. */
    readonly moduleId: string;
    readonly rankings: ReadonlyArray<{ readonly playerId: string }>;
    readonly winners: readonly string[];
    /** Bot seats: no profile, no XP, and they are not human opponents. */
    readonly botIds: readonly string[];
    /**
     * Humans who earn nothing (they forfeited by leaving). They still count as
     * human opponents for the others — beating a real player who rage-quit is
     * not a bot win.
     */
    readonly excluded?: readonly string[];
}

/**
 * Compute each human participant's XP for one finished game:
 *
 *   (PARTICIPATION_XP + winBonus) × gameWeight
 *   winBonus = WIN_XP_PER_OPPONENT × max(1, seats − 1)
 *              × (BOT_ONLY_WIN_FACTOR if no other human sat at the table)
 *
 * Bots and `excluded` players get no entry; empty if no human earns anything.
 */
export function computeXpAwards({
    moduleId,
    rankings,
    winners,
    botIds,
    excluded = [],
}: XpGameFacts): XpAward[] {
    const botSet = new Set(botIds);
    const excludedSet = new Set(excluded);
    const winSet = new Set(winners);

    const humans = rankings.filter(({ playerId }) => !botSet.has(playerId));
    const opponents = Math.max(1, rankings.length - 1);
    const humanFactor = humans.length > 1 ? 1 : BOT_ONLY_WIN_FACTOR;
    const winBonus = WIN_XP_PER_OPPONENT * opponents * humanFactor;
    const weight = xpWeightFor(moduleId);

    const awards: XpAward[] = [];
    for (const { playerId } of humans) {
        if (excludedSet.has(playerId)) continue;
        const raw = PARTICIPATION_XP + (winSet.has(playerId) ? winBonus : 0);
        awards.push({ playerId, amount: Math.round(raw * weight) });
    }
    return awards;
}
