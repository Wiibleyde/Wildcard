import type { ThemeTier } from "@/lib/card/types";

/** Typed against the dictionary keys: a new tier fails compilation until labelled. */
export const TIER_LABEL_KEY = {
    common: "tier_common",
    uncommon: "tier_uncommon",
    rare: "tier_rare",
    epic: "tier_epic",
    legendary: "tier_legendary",
    mystical: "tier_mystical",
    ethereal: "tier_ethereal",
} as const satisfies Record<ThemeTier, `tier_${ThemeTier}`>;

/** `[background, text]` for the `.stamp` chip. */
const TIER_STAMP: Record<ThemeTier, readonly [string, string]> = {
    common: ["var(--panel-d2)", "var(--muted)"],
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
