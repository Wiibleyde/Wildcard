"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/card/Card";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import { FACE_DOWN_CARD } from "@/lib/card/utils";
import { TIER_LABEL_KEY, tierColor, tierTextColor } from "@/lib/customize/tier";
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
    const tierName = t(TIER_LABEL_KEY[theme.tier]);

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
                    background: tierColor(theme.tier),
                    color: tierTextColor(theme.tier),
                }}
            >
                {tierName}
            </span>
        </TileShell>
    );
}
