"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useGameOverXp } from "@/hooks/game/useGameOverXp";
import { PARTICIPATION_XP, WIN_XP, xpProgress } from "@/lib/xp/xp";

gsap.registerPlugin(useGSAP);

/**
 * End-of-game XP reward. Shown only to a participant (the caller gates on the
 * viewer being in the rankings). The amount is derived locally from whether the
 * viewer won — the same constants the server awards — while the running total
 * is resolved authoritatively in {@link useGameOverXp}.
 *
 * Animation (GSAP): the panel rises in, the gained badge pops, the XP counter
 * tallies up from the pre-game total, and the bar fills to the new progress —
 * wrapping through 100% with a gold flash when the player levels up.
 */
export function GameOverXp({ userId, won }: { userId: string; won: boolean }) {
    "use no memo";
    const t = useTranslations("game");
    const gained = PARTICIPATION_XP + (won ? WIN_XP : 0);
    const xp = useGameOverXp(userId, gained);

    const containerRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const numRef = useRef<HTMLSpanElement>(null);
    const levelRef = useRef<HTMLSpanElement>(null);
    const levelUpRef = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (!xp.ready) return;

            const beforePct = xpProgress(xp.before) * 100;
            const afterPct = xpProgress(xp.after) * 100;
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.from(containerRef.current, {
                y: 14,
                opacity: 0,
                duration: 0.45,
            });

            // Gained badge pop.
            tl.from(
                ".xp-gained-badge",
                { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)" },
                "-=0.1",
            );

            // Count the total up from the pre-game value.
            tl.fromTo(
                numRef.current,
                { textContent: xp.before },
                {
                    textContent: xp.after,
                    duration: 1,
                    snap: { textContent: 1 },
                    ease: "power1.out",
                },
                "<",
            );

            // Bar fill — wrap through full on a level-up, then continue.
            gsap.set(barRef.current, { width: `${beforePct}%` });
            if (xp.leveledUp) {
                tl.to(
                    barRef.current,
                    { width: "100%", duration: 0.6, ease: "power2.in" },
                    "<",
                );
                tl.add(() => {
                    if (levelRef.current) {
                        levelRef.current.textContent = String(xp.levelAfter);
                    }
                });
                tl.set(barRef.current, { width: "0%" });
                tl.to(barRef.current, {
                    width: `${afterPct}%`,
                    duration: 0.7,
                    ease: "power2.out",
                });
                // Level-up burst + badge punch.
                tl.fromTo(
                    levelUpRef.current,
                    { scale: 0.5, opacity: 0, y: 6 },
                    {
                        scale: 1,
                        opacity: 1,
                        y: 0,
                        duration: 0.5,
                        ease: "back.out(2.2)",
                    },
                    "-=0.5",
                );
                tl.fromTo(
                    levelRef.current,
                    { scale: 1.6, color: "#f5c516" },
                    { scale: 1, color: "#a78bfa", duration: 0.6 },
                    "<",
                );
            } else {
                tl.to(
                    barRef.current,
                    { width: `${afterPct}%`, duration: 1, ease: "power2.out" },
                    "<",
                );
            }
        },
        { scope: containerRef, dependencies: [xp.ready, xp.after] },
    );

    if (!xp.ready) return null;

    return (
        <div ref={containerRef} className="w-full max-w-xs">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="text-xs font-black uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("xp_title")}
                    </span>
                    <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black"
                        style={{
                            background: "rgba(167,139,250,0.15)",
                            color: "#a78bfa",
                            border: "1px solid rgba(167,139,250,0.3)",
                        }}
                    >
                        {t("level_short")}{" "}
                        <span ref={levelRef} className="ml-1 tabular-nums">
                            {xp.levelBefore}
                        </span>
                    </span>
                </div>
                <span
                    className="xp-gained-badge inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-black tabular-nums"
                    style={{
                        background: "rgba(72,201,122,0.16)",
                        color: "#48c97a",
                        border: "1px solid rgba(72,201,122,0.35)",
                    }}
                >
                    +{xp.gained} XP
                </span>
            </div>

            <div
                className="relative h-3 overflow-hidden rounded-full"
                style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                }}
            >
                <div
                    ref={barRef}
                    className="relative h-full overflow-hidden rounded-full"
                    style={{
                        background:
                            "linear-gradient(90deg, #7c5ce8, #a78bfa, #c4b5fd)",
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

            <div className="mt-1.5 flex items-center justify-between">
                {xp.leveledUp ? (
                    <div
                        ref={levelUpRef}
                        className="text-xs font-black uppercase tracking-wider"
                        style={{ color: "#f5c516", opacity: 0 }}
                    >
                        ★ {t("level_up")}
                    </div>
                ) : (
                    <span />
                )}
                <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: "#7a6a50" }}
                >
                    <span ref={numRef}>{xp.before}</span> XP
                </span>
            </div>
        </div>
    );
}
