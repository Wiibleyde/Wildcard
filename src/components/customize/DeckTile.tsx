"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/card/Card";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import { TIER_KEYS } from "@/lib/card/tiers";
import type { CardTheme } from "@/lib/card/types";
import { FACE_DOWN_CARD } from "@/lib/card/utils";
import { type TierKey, tierColor, tierTextColor } from "@/lib/customize/tier";
import { TileShell } from "./TileShell";

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

    return (
        <TileShell
            selected={selected}
            onClick={onClick}
            previewHref={previewHref}
        >
            <div className={`${CARD_WIDTH_CLASS.xs} shrink-0`}>
                <Card card={FACE_DOWN_CARD} faceDown theme={theme} />
            </div>
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
