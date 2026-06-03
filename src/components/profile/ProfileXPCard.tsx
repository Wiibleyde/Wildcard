"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import type { Dictionary } from "@/lib/i18n";

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
    dict: Dictionary;
};

export function ProfileXPCard({ xp, dict }: Props) {
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
        <div
            ref={containerRef}
            className="bg-wc-panel border border-wc-border rounded-wc-panel p-5"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-wc-icon flex items-center justify-center bg-wc-xp-dim shrink-0">
                    <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 text-wc-xp"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-(length:--font-size-wc-label) font-bold text-wc-sub uppercase tracking-(--letter-spacing-wc-cap)">
                        {dict.profile.xp_title}
                    </p>
                    <p className="text-wc-heading font-extrabold leading-none mt-0.5">
                        {dict.profile.level_short}{" "}
                        <span className="text-wc-xp">{level}</span>
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <span
                        ref={xpNumRef}
                        className="text-2xl font-extrabold text-wc-text tabular-nums"
                    >
                        {xp}
                    </span>
                    <span className="text-wc-sub text-sm font-semibold ml-1">
                        XP
                    </span>
                </div>
            </div>

            <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
                <div
                    ref={barRef}
                    className="h-full rounded-full"
                    style={{
                        background: "linear-gradient(90deg, #a78bfa, #c4b5fd)",
                        width: "0%",
                    }}
                />
            </div>

            <p className="text-wc-sub text-xs font-semibold mt-2 text-right">
                {xpToNext.toLocaleString()} {dict.profile.xp_to_next}
            </p>
        </div>
    );
}
