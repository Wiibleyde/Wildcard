"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useXPBarAnimation } from "@/hooks/profile/useXPBarAnimation";
import { xpBreakdown } from "@/lib/xp/xp";

type Props = {
    xp: number;
};

export function ProfileXPCard({ xp }: Props) {
    "use no memo";
    const t = useTranslations("profile");
    const format = useFormatter();
    const { level, xpToNext, progress } = xpBreakdown(xp);
    const { containerRef, barRef, xpNumRef } = useXPBarAnimation(xp, progress);

    return (
        <div ref={containerRef}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span
                        className="stamp"
                        style={{
                            background: "var(--purple)",
                            color: "var(--accent-ink)",
                        }}
                    >
                        {t("xp_title")}
                    </span>
                    <span
                        className="font-display text-sm"
                        style={{ color: "var(--cream)" }}
                    >
                        {t("level_short")} {level}
                    </span>
                </div>
                <div className="text-right">
                    <span
                        ref={xpNumRef}
                        className="font-display text-xl tabular-nums"
                        style={{ color: "var(--cream)" }}
                    >
                        {xp}
                    </span>
                    <span
                        className="text-xs font-bold ml-1"
                        style={{ color: "var(--muted)" }}
                    >
                        XP
                    </span>
                </div>
            </div>

            <div
                className="relative h-4 rounded-full overflow-hidden"
                style={{
                    background: "#d6c79c",
                    border: "2.5px solid var(--ink)",
                }}
            >
                <div
                    ref={barRef}
                    className="h-full relative"
                    style={{
                        background: "var(--purple)",
                        width: "0%",
                    }}
                />
            </div>

            <p
                className="text-xs font-semibold mt-1.5 text-right"
                style={{ color: "var(--muted)" }}
            >
                {format.number(xpToNext)} {t("xp_to_next")}
            </p>
        </div>
    );
}
