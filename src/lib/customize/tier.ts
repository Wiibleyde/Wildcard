import type { ThemeTier } from "@/lib/card/types";

/**
 * Tier id → i18n key under the `customize` namespace. Typed against the
 * dictionary's literal keys, so `t(TIER_LABEL_KEY[tier])` type-checks without
 * a cast and a new tier fails compilation until it gets a label.
 */
export const TIER_LABEL_KEY = {
    common: "tier_common",
    uncommon: "tier_uncommon",
    rare: "tier_rare",
    epic: "tier_epic",
    legendary: "tier_legendary",
    mystical: "tier_mystical",
    ethereal: "tier_ethereal",
} as const satisfies Record<ThemeTier, `tier_${ThemeTier}`>;

/**
 * Neobrutalism tier stamps — solid fills from the v2 palette, ready for a
 * `.stamp` chip on a cream tile. Each entry is `[background, text]`, both
 * bordered by ink from the `.stamp` class.
 */
const TIER_STAMP: Record<ThemeTier, readonly [string, string]> = {
    common: ["var(--cream2)", "var(--ink)"],
    uncommon: ["var(--green)", "var(--ink)"],
    rare: ["var(--blue)", "var(--accent-ink)"],
    epic: ["var(--purple)", "var(--accent-ink)"],
    legendary: ["var(--gold)", "var(--ink)"],
    mystical: ["var(--red)", "var(--accent-ink)"],
    ethereal: ["var(--gold)", "var(--ink)"],
};

export function tierColor(tier: ThemeTier): string {
    return TIER_STAMP[tier][0];
}

export function tierTextColor(tier: ThemeTier): string {
    return TIER_STAMP[tier][1];
}
