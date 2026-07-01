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
                        className="text-xs font-black uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("xp_title")}
                    </span>
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black"
                        style={{
                            background: "rgba(167,139,250,0.15)",
                            color: "#26ccba",
                            border: "1px solid rgba(167,139,250,0.3)",
                        }}
                    >
                        {t("level_short")} {level}
                    </span>
                </div>
                <div className="text-right">
                    <span
                        ref={xpNumRef}
                        className="text-xl font-black tabular-nums"
                        style={{ color: "#faf2e2" }}
                    >
                        {xp}
                    </span>
                    <span
                        className="text-xs font-bold ml-1"
                        style={{ color: "#7a6a50" }}
                    >
                        XP
                    </span>
                </div>
            </div>

            <div
                className="relative h-3 rounded-full overflow-hidden"
                style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                }}
            >
                <div
                    ref={barRef}
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                        background:
                            "linear-gradient(90deg, #0e9e8e, #26ccba, #7af0e2)",
                        width: "0%",
                    }}
                >
                    <div
                        className="absolute inset-x-0 top-0 h-1/2 rounded-full"
                        style={{
                            background:
                                "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)",
                        }}
                    />
                </div>
            </div>

            <p
                className="text-xs font-semibold mt-1.5 text-right"
                style={{ color: "#7a6a50" }}
            >
                {format.number(xpToNext)} {t("xp_to_next")}
            </p>
        </div>
    );
}
