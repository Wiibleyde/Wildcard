"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import type { PlayGame } from "@/lib/games/catalog";

/** Stable ids for the (purely decorative) queue avatar discs. */
const SEAT_IDS = ["you", "p2", "p3", "p4", "p5"] as const;

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
    const accent = game?.accent ?? "var(--green)";
    // Avatar discs: the searcher plus everyone else currently in the queue.
    const seatIds = SEAT_IDS.slice(0, Math.max(1, Math.min(waiting + 1, 5)));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                background: "rgba(11,18,32,0.82)",
                backdropFilter: "blur(4px)",
            }}
        >
            <div className="panel-d relative flex w-full max-w-md flex-col items-center gap-6 px-8 py-10 text-center">
                {/* Spinner / found mark */}
                <div className="relative flex h-24 w-24 items-center justify-center">
                    {!matched && (
                        <span
                            className="wc-spinner absolute inset-0"
                            style={{
                                borderWidth: "4px",
                                borderStyle: "solid",
                                borderColor: "var(--panel-d2)",
                                borderTopColor: "var(--gold)",
                                borderRadius: 14,
                            }}
                        />
                    )}
                    <span
                        className="font-display text-5xl leading-none"
                        style={{ color: matched ? "var(--gold)" : accent }}
                    >
                        {matched ? "♠" : (game?.suits.trim()[0] ?? "♥")}
                    </span>
                </div>

                <div className="flex flex-col gap-1.5">
                    <h2
                        className="font-display text-2xl leading-tight"
                        style={{ color: "var(--cream)" }}
                    >
                        {matched ? t("match_found") : t("searching_title")}
                    </h2>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--muted)" }}
                    >
                        {matched
                            ? t("entering")
                            : (game?.name ?? t("searching_title"))}
                    </p>
                </div>

                {/* Queue avatar row: flat discs ringed with a thick ink border. */}
                <div className="flex items-center gap-2">
                    {seatIds.map((id, i) => (
                        <span
                            key={id}
                            className="h-9 w-9 rounded-full"
                            style={{
                                background:
                                    i === 0 ? accent : "var(--panel-d2)",
                                border: "2.5px solid var(--ink)",
                            }}
                        />
                    ))}
                </div>

                {!matched && (
                    <>
                        <div className="flex items-center gap-6">
                            <Stat
                                value={`${elapsed}s`}
                                label={t("elapsed_label")}
                                accent="var(--gold)"
                            />
                            <span
                                className="h-8 w-0.5 rounded-full"
                                style={{ background: "var(--ink)" }}
                            />
                            <Stat
                                value={String(waiting)}
                                label={t("in_queue_label")}
                                accent="var(--gold)"
                            />
                        </div>

                        <div className="flex w-full flex-col gap-2">
                            <GameButton
                                variant="red"
                                size="md"
                                onClick={onPlayBots}
                                className="w-full"
                            >
                                {t("play_bots")}
                            </GameButton>
                            <GameButton
                                variant="ghost"
                                size="sm"
                                onClick={onCancel}
                                className="w-full"
                            >
                                {t("cancel")}
                            </GameButton>
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
        <div className="flex flex-col items-center gap-1">
            <span
                className="font-display text-2xl leading-none"
                style={{ color: accent }}
            >
                {value}
            </span>
            <span
                className="stamp"
                style={{
                    background: "var(--panel-d2)",
                    color: "var(--muted)",
                    borderColor: "var(--ink)",
                }}
            >
                {label}
            </span>
        </div>
    );
}
