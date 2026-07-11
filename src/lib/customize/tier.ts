export type TierKey =
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mystical"
    | "ethereal";

/**
 * Neobrutalism tier stamps — solid fills from the v2 palette, ready for a
 * `.stamp` chip on a cream tile. Each entry is `[background, text]`, both
 * bordered by ink from the `.stamp` class.
 */
const TIER_STAMP: Record<TierKey, readonly [string, string]> = {
    common: ["var(--cream2)", "var(--ink)"],
    uncommon: ["var(--green)", "var(--ink)"],
    rare: ["var(--blue)", "var(--accent-ink)"],
    epic: ["var(--purple)", "var(--accent-ink)"],
    legendary: ["var(--gold)", "var(--ink)"],
    mystical: ["var(--red)", "var(--accent-ink)"],
    ethereal: ["var(--gold)", "var(--ink)"],
};

export function tierColor(tier: TierKey): string {
    return (TIER_STAMP[tier] ?? TIER_STAMP.common)[0];
}

export function tierTextColor(tier: TierKey): string {
    return (TIER_STAMP[tier] ?? TIER_STAMP.common)[1];
}
