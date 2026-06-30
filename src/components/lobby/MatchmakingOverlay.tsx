"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PlayGame } from "@/lib/games/catalog";

interface Props {
    /** Game being searched (absent while we only know "matched"). */
    readonly game?: PlayGame;
    readonly matched: boolean;
    readonly waiting: number;
    /** `Date.now()` when the search started — drives the elapsed counter. */
    readonly since: number;
    readonly onCancel: () => void;
    readonly onPlayBots: () => void;
}

/**
 * Full-screen quick-match status: a spinning suit, live elapsed time and queue
 * size while searching, then a "match found" flash as we walk into the game.
 * The host can bail into a bot-filled game at any time.
 */
export function MatchmakingOverlay({
    game,
    matched,
    waiting,
    since,
    onCancel,
    onPlayBots,
}: Props) {
    const t = useTranslations("lobby");
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (matched) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [matched]);

    const elapsed = Math.max(0, Math.floor((now - since) / 1000));
    const accent = game?.accent ?? "#48c97a";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                background: "rgba(8,5,2,0.82)",
                backdropFilter: "blur(4px)",
            }}
        >
            <div
                className="relative flex w-full max-w-md flex-col items-center gap-6 rounded-3xl px-8 py-10 text-center"
                style={{
                    background:
                        "linear-gradient(160deg, #1e1408 0%, #120d06 70%)",
                    border: `2px solid ${accent}55`,
                    boxShadow: `0 0 60px ${accent}22`,
                }}
            >
                {/* Spinner / found mark */}
                <div className="relative flex h-24 w-24 items-center justify-center">
                    {!matched && (
                        <span
                            className="absolute inset-0 animate-spin rounded-full"
                            style={{
                                border: "3px solid rgba(255,255,255,0.06)",
                                borderTopColor: accent,
                                animationDuration: "1s",
                            }}
                        />
                    )}
                    <span
                        className="text-5xl font-black leading-none"
                        style={{ color: accent }}
                    >
                        {matched ? "♠" : (game?.suits.trim()[0] ?? "♥")}
                    </span>
                </div>

                <div className="flex flex-col gap-1">
                    <h2
                        className="text-2xl font-black"
                        style={{ color: "#faf2e2" }}
                    >
                        {matched ? t("match_found") : t("searching_title")}
                    </h2>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {matched
                            ? t("entering")
                            : (game?.name ?? t("searching_title"))}
                    </p>
                </div>

                {!matched && (
                    <>
                        <div className="flex items-center gap-6">
                            <Stat
                                value={`${elapsed}s`}
                                label={t("elapsed_label")}
                                accent={accent}
                            />
                            <span
                                className="h-8 w-px"
                                style={{ background: "#3d2d18" }}
                            />
                            <Stat
                                value={String(waiting)}
                                label={t("in_queue_label")}
                                accent={accent}
                            />
                        </div>

                        <div className="flex w-full flex-col gap-2">
                            <button
                                type="button"
                                onClick={onPlayBots}
                                className="rounded-xl py-3 font-black text-sm transition-transform active:scale-95"
                                style={{
                                    background: accent,
                                    color: "#0d0a05",
                                    boxShadow: `0 4px 0 0 ${game?.shadow ?? "#1a6038"}`,
                                }}
                            >
                                {t("play_bots")}
                            </button>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="rounded-xl py-2.5 text-sm font-bold transition-colors"
                                style={{ color: "#9a8870" }}
                            >
                                {t("cancel")}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Stat({
    value,
    label,
    accent,
}: {
    value: string;
    label: string;
    accent: string;
}) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl font-black" style={{ color: accent }}>
                {value}
            </span>
            <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#7a6a50" }}
            >
                {label}
            </span>
        </div>
    );
}
