"use client";

import { useTranslations } from "next-intl";
import { GameBoard } from "@/components/board/GameBoard";
import { Card } from "@/components/card/Card";
import type { BoardPlayer, BoardTheme } from "@/lib/board/types";
import type { CardTheme } from "@/lib/card/types";
import { cardKey } from "@/lib/engine/deck";
import type { GameAction } from "@/lib/engine/types";
import type { BatailleView } from "@/lib/games/bataille/bataille";
import type { GameClientPayload } from "@/lib/models/game";
import { GameOverOverlay, TurnBanner } from "./GameChrome";

interface Props {
    view: BatailleView;
    payload: GameClientPayload;
    currentUserId: string;
    deckTheme: CardTheme;
    boardTheme: BoardTheme;
    pending: boolean;
    onAction: (action: GameAction) => void;
}

export function BatailleTable({
    view,
    payload,
    currentUserId,
    deckTheme,
    boardTheme,
    pending,
    onAction,
}: Props) {
    const t = useTranslations("game");

    const boardPlayers: BoardPlayer[] = view.players.map((p) => ({
        userId: p.playerId,
        username: p.name,
        deckStyleId: deckTheme.id,
        isCurrentPlayer: p.playerId === currentUserId,
    }));

    const self = view.players.find((p) => p.playerId === currentUserId);
    const flipAction = payload.legalActions.find((a) => a.type === "flip");
    const canFlip = !payload.isOver && flipAction !== undefined;

    const banner = payload.isOver
        ? t("game_over")
        : self
          ? t("your_turn")
          : t("spectating");

    const playArea = (
        <div className="flex w-full flex-col items-center gap-3 py-3">
            <div className="flex items-start justify-center gap-8">
                {view.players.map((p) => (
                    <div
                        key={p.playerId}
                        className="flex flex-col items-center gap-2"
                    >
                        <span
                            className="text-xs font-bold"
                            style={{ color: boardTheme.badge.textColor }}
                        >
                            {p.name}
                        </span>
                        <div className="flex">
                            {p.lastReveal.length === 0 ? (
                                <div
                                    className="h-20 w-14 rounded-md"
                                    style={{
                                        border: "1px dashed rgba(255,255,255,0.2)",
                                    }}
                                />
                            ) : (
                                p.lastReveal.map((card, i) => (
                                    <div
                                        key={cardKey(card)}
                                        className="w-14"
                                        style={{
                                            marginLeft: i === 0 ? 0 : "-2.2rem",
                                        }}
                                    >
                                        <Card card={card} theme={deckTheme} />
                                    </div>
                                ))
                            )}
                        </div>
                        <span
                            className="text-xs font-semibold"
                            style={{ color: boardTheme.badge.textColor }}
                        >
                            {t("cards_left", { n: p.total })}
                        </span>
                    </div>
                ))}
            </div>
            <span
                className="text-sm font-black"
                style={{ color: boardTheme.accentColor }}
            >
                {view.lastWinner
                    ? t("last_winner", {
                          name:
                              view.players.find(
                                  (p) => p.playerId === view.lastWinner,
                              )?.name ?? "?",
                      })
                    : view.turn > 0
                      ? t("draw_round")
                      : ""}
            </span>
        </div>
    );

    const handArea = self ? (
        <div className="flex flex-col items-center gap-3 py-2">
            {canFlip && (
                <button
                    type="button"
                    onClick={() => flipAction && onAction(flipAction)}
                    disabled={pending}
                    className="rounded-xl px-10 py-3 font-black text-base disabled:opacity-50"
                    style={{
                        background: "#f5c516",
                        color: "#0d0a05",
                        boxShadow: "0 4px 0 0 #7a5a00",
                    }}
                >
                    {t("flip")}
                </button>
            )}
        </div>
    ) : (
        <span className="text-sm" style={{ opacity: 0.5 }}>
            {t("spectating")}
        </span>
    );

    return (
        <div className="mx-auto flex w-full max-w-3xl xl:max-w-5xl flex-col gap-3">
            <TurnBanner label={banner} highlight={canFlip} />
            <div className="relative h-[60vh] min-h-120">
                <GameBoard
                    theme={boardTheme}
                    players={boardPlayers}
                    playArea={playArea}
                    handArea={handArea}
                />
                {payload.isOver && (
                    <GameOverOverlay
                        outcome={payload.outcome}
                        players={payload.players}
                        currentUserId={currentUserId}
                    />
                )}
            </div>
        </div>
    );
}
