"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

const XP_PER_LEVEL = 500;

function xpStats(xp: number) {
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpInLevel = xp % XP_PER_LEVEL;
    const xpToNext = XP_PER_LEVEL - xpInLevel;
    const progress = xpInLevel / XP_PER_LEVEL;
    return { level, xpInLevel, xpToNext, progress };
}

type Props = {
    xp: number;
};

export function ProfileXPCard({ xp }: Props) {
    "use no memo";
    const t = useTranslations("profile");
    const containerRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const xpNumRef = useRef<HTMLSpanElement>(null);

    const { level, xpToNext, progress } = xpStats(xp);

    useGSAP(
        () => {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.from(containerRef.current, {
                y: 16,
                opacity: 0,
                duration: 0.55,
            });

            tl.fromTo(
                barRef.current,
                { width: "0%" },
                {
                    width: `${progress * 100}%`,
                    duration: 1.1,
                    ease: "power2.out",
                },
                "-=0.2",
            );

            tl.from(
                xpNumRef.current,
                {
                    textContent: 0,
                    duration: 0.9,
                    snap: { textContent: 1 },
                    ease: "power1.out",
                },
                "<",
            );
        },
        { scope: containerRef, dependencies: [xp] },
    );

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
                            color: "#a78bfa",
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

            {/* XP bar — game health bar style */}
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
                            "linear-gradient(90deg, #7c5ce8, #a78bfa, #c4b5fd)",
                        width: "0%",
                    }}
                >
                    {/* Shine line on top of bar */}
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
                {xpToNext.toLocaleString()} {t("xp_to_next")}
            </p>
        </div>
    );
}
