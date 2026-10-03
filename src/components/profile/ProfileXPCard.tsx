"use client";

import { useTranslations } from "next-intl";
import { useXPBarAnimation } from "@/hooks/profile/useXPBarAnimation";
import { xpBreakdown } from "@/lib/xp/xp";

export function ProfileXPCard({ xp }: { xp: number }) {
    const t = useTranslations("profile");
    const { level, xpToNext, progress } = xpBreakdown(xp);
    const { containerRef, barRef, xpNumRef } = useXPBarAnimation(xp, progress);

    return (
        <div ref={containerRef}>
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="stamp"
                        style={{
                            background: "var(--purple)",
                            color: "#fff",
                        }}
                    >
                        {t("xp_title")}
                    </span>
                    <span className="font-display text-sm text-wc-cream">
                        {t("level", { level })}
                    </span>
                </div>
                <div className="text-right">
                    <span
                        ref={xpNumRef}
                        className="font-display text-2xl tabular-nums text-shadow"
                    >
                        {xp}
                    </span>
                    <span className="ml-1 text-xs font-bold text-wc-muted">
                        {t("xp_unit")}
                    </span>
                </div>
            </div>

            <div className="relative h-3.5 overflow-hidden rounded-full bg-wc-panel-d2">
                <div
                    ref={barRef}
                    className="relative h-full rounded-full bg-wc-purple shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]"
                    style={{ width: "0%" }}
                />
            </div>

            <p className="mt-1.5 text-right text-xs font-semibold text-wc-muted">
                {t("xp_to_next", { n: xpToNext })}
            </p>
        </div>
    );
}
