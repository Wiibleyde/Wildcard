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
                    { scale: 1.6, color: "#ffc23d" },
                    { scale: 1, color: "#9b6cf2", duration: 0.6 },
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
        <div ref={containerRef} className="panel w-full max-w-xs p-3">
            <div className="flex items-center gap-3">
                {/* chunky ink-bordered reward tile */}
                <div
                    className="xp-gained-badge grid size-12 shrink-0 place-items-center rounded-xl border-nb font-display text-xl leading-none"
                    style={{
                        background: "var(--purple)",
                        color: "var(--accent-ink)",
                        borderColor: "var(--ink)",
                        boxShadow: "0 3px 0 var(--ink)",
                    }}
                    aria-hidden="true"
                >
                    XP
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className="stamp"
                            style={{
                                background: "var(--cream2)",
                                color: "var(--ink)",
                            }}
                        >
                            {t("xp_title")}
                        </span>
                        <span
                            className="stamp"
                            style={{
                                background: "var(--purple)",
                                color: "var(--accent-ink)",
                            }}
                        >
                            {t("level_short")}{" "}
                            <span ref={levelRef} className="tabular-nums">
                                {xp.levelBefore}
                            </span>
                        </span>
                    </div>

                    <div
                        className="mt-1.5 font-display text-2xl leading-none tabular-nums"
                        style={{ color: "var(--purple)" }}
                    >
                        +{xp.gained}{" "}
                        <span className="text-sm" style={{ color: "#5a5340" }}>
                            XP
                        </span>
                    </div>
                </div>
            </div>

            <div
                className="relative mt-3 h-3 overflow-hidden rounded-full border-2"
                style={{
                    background: "var(--cream2)",
                    borderColor: "var(--ink)",
                }}
            >
                <div
                    ref={barRef}
                    className="relative h-full overflow-hidden rounded-full"
                    style={{
                        background: "var(--purple)",
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
                        className="font-display text-xs uppercase tracking-wider"
                        style={{ color: "var(--gold)", opacity: 0 }}
                    >
                        ★ {t("level_up")}
                    </div>
                ) : (
                    <span />
                )}
                <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: "#5a5340" }}
                >
                    <span ref={numRef}>{xp.before}</span> XP
                </span>
            </div>
        </div>
    );
}
