"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/card/Card";
import { TierBadge } from "@/components/ui/TierBadge";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import { FACE_DOWN_CARD } from "@/lib/card/utils";
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

    return (
        <TileShell
            selected={selected}
            onClick={onClick}
            previewHref={previewHref}
        >
            <div className={`${CARD_WIDTH_CLASS.xs} shrink-0`}>
                <Card card={FACE_DOWN_CARD} faceDown theme={theme} />
            </div>
            <span className="text-xs font-semibold text-wc-text truncate w-full text-center">
                {theme.name}
            </span>
            <TierBadge tier={theme.tier} name={tierName} />
        </TileShell>
    );
}
