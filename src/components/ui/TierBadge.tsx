import { useTranslations } from "next-intl";
import type { ThemeTier } from "@/lib/card/types";
import { TIER_LABEL_KEY, tierColor, tierTextColor } from "@/lib/customize/tier";

export function TierBadge({ tier }: { tier: ThemeTier }) {
    const t = useTranslations("customize");
    return (
        <span
            className="stamp"
            style={{ background: tierColor(tier), color: tierTextColor(tier) }}
        >
            {t(TIER_LABEL_KEY[tier])}
        </span>
    );
}
