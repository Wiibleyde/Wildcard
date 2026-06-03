export type TierKey =
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mystical"
    | "ethereal";

export function tierColor(tier: TierKey): string {
    const map: Record<TierKey, string> = {
        common: "rgba(156,163,175,0.15)",
        uncommon: "rgba(74,222,128,0.15)",
        rare: "rgba(96,165,250,0.15)",
        epic: "rgba(167,139,250,0.15)",
        legendary: "rgba(251,191,36,0.15)",
        mystical: "rgba(251,113,133,0.15)",
        ethereal: "rgba(232,196,104,0.20)",
    };
    return map[tier] ?? map.common;
}

export function tierTextColor(tier: TierKey): string {
    const map: Record<TierKey, string> = {
        common: "#9ca3af",
        uncommon: "#4ade80",
        rare: "#60a5fa",
        epic: "#a78bfa",
        legendary: "#fbbf24",
        mystical: "#fb7185",
        ethereal: "#e8c468",
    };
    return map[tier] ?? map.common;
}
