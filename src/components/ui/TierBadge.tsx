import { useTranslations } from "next-intl";
import type { ThemeTier } from "@/lib/card/types";
import { TIER_LABEL_KEY, tierColor, tierTextColor } from "@/lib/customize/tier";

type Props = {
    tier: ThemeTier;
};

/** Pill showing a theme's localized tier name in its tier colours. */
export function TierBadge({ tier }: Props) {
    const t = useTranslations("customize");
    return (
        <span
            className="text-wc-label font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: tierColor(tier), color: tierTextColor(tier) }}
        >
            {t(TIER_LABEL_KEY[tier])}
        </span>
    );
}
