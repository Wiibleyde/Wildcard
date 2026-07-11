"use client";

import { useTranslations } from "next-intl";
import type { BoardTheme } from "@/lib/board/types";
import { TIER_KEYS } from "@/lib/card/tiers";
import { type TierKey, tierColor, tierTextColor } from "@/lib/customize/tier";
import { TileShell } from "./TileShell";

type Props = {
    theme: BoardTheme;
    selected: boolean;
    onClick: () => void;
    previewHref: string;
};

export function BoardTile({ theme, selected, onClick, previewHref }: Props) {
    "use no memo";
    const t = useTranslations("customize");
    const tierKey = TIER_KEYS[theme.tier];
    // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
    const tierName = tierKey ? t(tierKey as any) : theme.tier;

    return (
        <TileShell
            selected={selected}
            onClick={onClick}
            previewHref={previewHref}
        >
            <div
                className="w-16 h-10 rounded-md overflow-hidden shrink-0"
                style={{
                    background: theme.surface.background,
                    border: "2.5px solid var(--ink)",
                }}
            />
            <span
                className="text-xs font-display truncate w-full text-center"
                style={{ color: "var(--ink)" }}
            >
                {theme.name}
            </span>
            <span
                className="stamp"
                style={{
                    background: tierColor(theme.tier as TierKey),
                    color: tierTextColor(theme.tier as TierKey),
                }}
            >
                {tierName}
            </span>
        </TileShell>
    );
}
