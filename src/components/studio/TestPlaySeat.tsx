"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import {
    cardLabel,
    isRedSuit,
    type TestSeatState,
} from "@/hooks/studio/useTestPlay";
import { cardKey } from "@/lib/card/utils";
import type { EcaAction } from "@/lib/eca/types";

/**
 * One seat in the sandbox, rendered entirely from that seat's own redacted
 * view: its hand, which cards are legal to play, and the draw / pass actions.
 * Every control dispatches through `onAct` — the same runner path a real match
 * uses.
 */
export function TestPlaySeat({
    seat,
    over,
    onAct,
}: {
    readonly seat: TestSeatState;
    readonly over: boolean;
    readonly onAct: (action: EcaAction) => void;
}) {
    const t = useTranslations("studio");
    return (
        <div
            className="flex flex-col gap-2 rounded-xl p-3"
            style={{
                background: "var(--panel-d2)",
                border: `2.5px solid ${seat.isCurrent && !over ? "var(--gold)" : "var(--ink)"}`,
            }}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm text-wc-cream">
                    {seat.player.name}
                </span>
                {seat.isCurrent && !over && (
                    <span
                        className="stamp"
                        style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                        }}
                    >
                        ▶
                    </span>
                )}
                <div className="ml-auto flex gap-2">
                    <GameButton
                        variant="teal"
                        size="sm"
                        onClick={() =>
                            onAct({
                                type: "drawCard",
                                playerId: seat.player.id,
                            })
                        }
                        disabled={!seat.canDraw || over}
                    >
                        {t("test_draw")}
                    </GameButton>
                    <GameButton
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            onAct({ type: "pass", playerId: seat.player.id })
                        }
                        disabled={!seat.canPass || over}
                    >
                        {t("test_pass")}
                    </GameButton>
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {seat.hand.map((card) => {
                    const key = cardKey(card);
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() =>
                                onAct({
                                    type: "playCard",
                                    playerId: seat.player.id,
                                    card,
                                })
                            }
                            disabled={over || !seat.playable.has(key)}
                            className="wc-chip rounded-lg px-2 py-1.5 text-sm font-bold disabled:opacity-40"
                            style={{
                                background: "var(--cream)",
                                border: "2px solid var(--ink)",
                                boxShadow: "0 2px 0 var(--ink)",
                                color: isRedSuit(card)
                                    ? "var(--red)"
                                    : "var(--ink)",
                            }}
                        >
                            {cardLabel(card)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
