"use client";

import { useTranslations } from "next-intl";
import { TierBadge } from "@/components/ui/TierBadge";
import type { BoardTheme } from "@/lib/board/types";
import { TIER_KEYS } from "@/lib/card/tiers";
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
                style={{ background: theme.surface.background }}
            />
            <span className="text-xs font-semibold text-wc-text truncate w-full text-center">
                {theme.name}
            </span>
            <TierBadge tier={theme.tier} name={tierName} />
        </TileShell>
    );
}
