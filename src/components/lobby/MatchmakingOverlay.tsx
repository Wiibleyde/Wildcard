"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { Modal } from "@/components/ui/Modal";
import type { PlayGame } from "@/lib/games/catalog";

/** How long a "matched" flash may hang before an exit is offered (ms). */
const MATCHED_EXIT_DELAY = 8000;

const SEAT_IDS = ["you", "p2", "p3", "p4", "p5"] as const;

interface Props {
    /** Absent while we only know "matched". */
    readonly game?: PlayGame;
    readonly matched: boolean;
    readonly waiting: number;
    /** `Date.now()` when the search started. */
    readonly since: number;
    readonly onCancel: () => void;
    readonly onPlayBots: () => void;
}

export function MatchmakingOverlay({
    game,
    matched,
    waiting,
    since,
    onCancel,
    onPlayBots,
}: Props) {
    const t = useTranslations("lobby");
    const tCommon = useTranslations("common");
    const [now, setNow] = useState(() => Date.now());
    // If the game never arrives after "matched", offer a way out instead of a
    // modal with no buttons.
    const [stuck, setStuck] = useState(false);
    const titleId = useId();

    useEffect(() => {
        if (matched) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [matched]);

    useEffect(() => {
        setStuck(false);
        if (!matched) return;
        const id = setTimeout(() => setStuck(true), MATCHED_EXIT_DELAY);
        return () => clearTimeout(id);
    }, [matched]);

    const elapsed = Math.max(0, Math.floor((now - since) / 1000));
    const accent = game?.accent ?? "var(--green)";
    const seatIds = SEAT_IDS.slice(0, Math.max(1, Math.min(waiting + 1, 5)));

    return (
        <Modal
            open
            onClose={onCancel}
            closeLabel={tCommon("cancel")}
            labelledBy={titleId}
            dismissible={!matched || stuck}
            className="panel-d flex max-w-md flex-col items-center gap-6 px-8 py-10 text-center"
        >
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
                    aria-hidden="true"
                    className="font-display text-5xl leading-none"
                    style={{ color: matched ? "var(--gold)" : accent }}
                >
                    {matched ? "♠" : (game?.suits.trim()[0] ?? "♥")}
                </span>
            </div>

            <div className="flex flex-col gap-1.5">
                <h2
                    id={titleId}
                    aria-live="polite"
                    className="font-display text-2xl leading-tight text-wc-cream"
                >
                    {matched ? t("match_found") : t("searching_title")}
                </h2>
                <p className="text-sm font-semibold text-wc-muted">
                    {matched
                        ? t("entering")
                        : (game?.name ?? t("searching_title"))}
                </p>
            </div>

            <div aria-hidden="true" className="flex items-center gap-2">
                {seatIds.map((id, i) => (
                    <span
                        key={id}
                        className="h-9 w-9 rounded-full border-nb border-wc-ink"
                        style={{
                            background: i === 0 ? accent : "var(--panel-d2)",
                        }}
                    />
                ))}
            </div>

            {!matched && (
                <>
                    <div className="flex items-center gap-6">
                        <Stat
                            value={t("elapsed_value", { s: elapsed })}
                            label={t("elapsed_label")}
                        />
                        <span className="h-8 w-0.5 rounded-full bg-wc-ink" />
                        <Stat
                            value={String(waiting)}
                            label={t("in_queue_label")}
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
                            {tCommon("cancel")}
                        </GameButton>
                    </div>
                </>
            )}

            {matched && stuck && (
                <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    className="w-full"
                >
                    {tCommon("cancel")}
                </GameButton>
            )}
        </Modal>
    );
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="font-display text-2xl leading-none text-wc-gold">
                {value}
            </span>
            <span
                className="stamp"
                style={{ background: "var(--panel-d2)", color: "var(--muted)" }}
            >
                {label}
            </span>
        </div>
    );
}
