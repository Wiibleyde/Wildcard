"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useGameOverXp } from "@/hooks/game/useGameOverXp";
import { gsap, useGSAP } from "@/lib/gsap";
import { tweenCount, writeOwnedText } from "@/lib/gsap/textTween";
import { xpProgress } from "@/lib/xp/xp";

export function GameOverXp({
    userId,
    gained,
}: {
    userId: string;
    gained: number;
}) {
    "use no memo";
    const t = useTranslations("game");
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
            writeOwnedText(levelRef.current, String(xp.levelBefore));

            tl.from(containerRef.current, {
                y: 14,
                opacity: 0,
                duration: 0.45,
            });
            tl.from(
                ".xp-gained-badge",
                { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)" },
                "-=0.1",
            );
            tweenCount(
                tl,
                numRef.current,
                xp.before,
                xp.after,
                { duration: 1, ease: "power1.out" },
                "<",
            );

            gsap.set(barRef.current, { width: `${beforePct}%` });
            if (xp.leveledUp) {
                tl.to(
                    barRef.current,
                    { width: "100%", duration: 0.6, ease: "power2.in" },
                    "<",
                );
                tl.add(() => {
                    writeOwnedText(levelRef.current, String(xp.levelAfter));
                });
                tl.set(barRef.current, { width: "0%" });
                tl.to(barRef.current, {
                    width: `${afterPct}%`,
                    duration: 0.7,
                    ease: "power2.out",
                });
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
                    { scale: 1.6, color: "var(--gold)" },
                    { scale: 1, duration: 0.6, clearProps: "color" },
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
        // The total can be revised upward by a late Realtime event: revert the
        // previous timeline instead of racing it.
        {
            scope: containerRef,
            dependencies: [xp.ready, xp.after],
            revertOnUpdate: true,
        },
    );

    if (!xp.ready) return null;

    return (
        <div ref={containerRef} className="panel w-full max-w-xs p-3">
            <div className="flex items-center gap-3">
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
                    {t("xp_unit")}
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
                            {t.rich("level_badge", {
                                level: xp.levelBefore,
                                n: (chunks) => (
                                    <span
                                        ref={levelRef}
                                        className="tabular-nums"
                                    >
                                        {chunks}
                                    </span>
                                ),
                            })}
                        </span>
                    </div>

                    <div
                        className="mt-1.5 font-display text-2xl leading-none tabular-nums"
                        style={{ color: "var(--purple)" }}
                    >
                        +{xp.gained}{" "}
                        <span
                            className="text-sm"
                            style={{ color: "var(--ink-soft)" }}
                        >
                            {t("xp_unit")}
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
                    style={{ color: "var(--ink-soft)" }}
                >
                    <span ref={numRef}>{xp.before}</span> {t("xp_unit")}
                </span>
            </div>
        </div>
    );
}
