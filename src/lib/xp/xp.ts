import { isEcaModuleId } from "@/lib/eca/id";

/**
 * XP rewards playing, not beating rated humans: additive, never zero-sum.
 * Pure — the server derives awards from the engine outcome and persists them.
 */

export const PARTICIPATION_XP = 50;

/** Per beaten seat: winning is harder at a bigger table. Solo counts the deck as one. */
export const WIN_XP_PER_OPPONENT = 35;

/** Bot-only wins pay less, so farming bots never outpaces playing people. */
export const BOT_ONLY_WIN_FACTOR = 0.5;

/**
 * Sub-linear in typical game length (Président ≈ 12 min = 1.0), so the
 * shortest game is not the best farm.
 */
export const GAME_XP_WEIGHT: Readonly<Record<string, number>> = {
    bataille: 0.35,
    solitaire: 0.6,
    president: 1,
    tarot: 1.4,
};

/** Studio games can be one move long: below every native game. */
export const ECA_XP_WEIGHT = 0.5;

export const DEFAULT_XP_WEIGHT = 1;

export function xpWeightFor(moduleId: string): number {
    if (isEcaModuleId(moduleId)) return ECA_XP_WEIGHT;
    return GAME_XP_WEIGHT[moduleId] ?? DEFAULT_XP_WEIGHT;
}

/**
 * Total XP to reach level L = BASE_XP × (L−1)^LEVEL_EXPONENT: each level costs
 * more, but sub-quadratically, so high levels stay reachable (level 10 ≈ 8.4k,
 * level 20 ≈ 27.8k) where an exponential curve walls off around 20.
 */
export const BASE_XP = 250;
export const LEVEL_EXPONENT = 1.6;

/** Rounded so thresholds stay whole numbers; level 1 sits at 0 XP. */
export function xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round(BASE_XP * (level - 1) ** LEVEL_EXPONENT);
}

export function levelForXp(xp: number): number {
    if (xp <= 0) return 1;
    // Invert the power law, then correct float drift against the rounded thresholds.
    const guess = Math.floor((xp / BASE_XP) ** (1 / LEVEL_EXPONENT));
    let level = Math.max(1, guess + 1);
    while (xpForLevel(level + 1) <= xp) level++;
    while (level > 1 && xpForLevel(level) > xp) level--;
    return level;
}

export function xpBreakdown(xp: number): {
    readonly level: number;
    readonly xpIntoLevel: number;
    readonly xpToNext: number;
    /** 0..1 toward the next level. */
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

/** Shorthand for `xpBreakdown(xp).progress`. */
export function xpProgress(xp: number): number {
    return xpBreakdown(xp).progress;
}

export interface XpAward {
    readonly playerId: string;
    readonly amount: number;
}

export interface XpGameFacts {
    readonly moduleId: string;
    readonly rankings: ReadonlyArray<{ readonly playerId: string }>;
    readonly winners: readonly string[];
    /** No XP, and not human opponents. */
    readonly botIds: readonly string[];
    /** Forfeiters earn nothing but still count as human opponents. */
    readonly excluded?: readonly string[];
}

/**
 * (PARTICIPATION_XP + winBonus) × weight, with
 * winBonus = WIN_XP_PER_OPPONENT × max(1, seats − 1) × (BOT_ONLY_WIN_FACTOR if no other human).
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
