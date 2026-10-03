"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { TestSeatState } from "@/hooks/studio/useTestPlay";
import { cardKey } from "@/lib/card/utils";
import { ecaCardLabel as cardLabel, isRedSuit } from "@/lib/eca/display";
import type { EcaAction } from "@/lib/eca/types";

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
            className="well flex flex-col gap-2 border-2 p-3"
            style={{
                borderColor:
                    seat.isCurrent && !over ? "var(--orange)" : "var(--edge)",
            }}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold">
                    {seat.player.name}
                </span>
                {seat.isCurrent && !over && (
                    <span className="stamp bg-wc-orange text-white">▶</span>
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
                            className="wc-chip rounded-lg bg-wc-cream px-2 py-1.5 text-sm font-bold [--press:#9b90ad] disabled:opacity-40"
                            style={{
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
