"use client";

import { useTranslations } from "next-intl";
import { TierBadge } from "@/components/ui/TierBadge";
import type { CardTheme } from "@/lib/card/types";
import { TileShell } from "./TileShell";

const TIER_KEYS: Record<string, string> = {
    common: "tier_common",
    uncommon: "tier_uncommon",
    rare: "tier_rare",
    epic: "tier_epic",
    legendary: "tier_legendary",
    mystical: "tier_mystical",
    ethereal: "tier_ethereal",
};

type Props = {
    theme: CardTheme;
    selected: boolean;
    onClick: () => void;
    previewHref: string;
};

export function DeckTile({ theme, selected, onClick, previewHref }: Props) {
    "use no memo";
    const t = useTranslations("customize");
    const tierKey = TIER_KEYS[theme.tier];
    // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
    const tierName = tierKey ? t(tierKey as any) : theme.tier;

    const backBg = theme.back.pattern ?? theme.back.color;

    return (
        <TileShell
            selected={selected}
            onClick={onClick}
            previewHref={previewHref}
        >
            <div
                className="w-10 h-14 rounded-md overflow-hidden shrink-0"
                style={{
                    background: backBg,
                    backgroundColor: theme.back.color,
                    border: `1px solid ${theme.border.color}`,
                }}
            />
            <span className="text-xs font-semibold text-wc-text truncate w-full text-center">
                {theme.name}
            </span>
            <TierBadge tier={theme.tier} name={tierName} />
        </TileShell>
    );
}
