"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { Card } from "@/components/card/Card";
import type { BoardTheme } from "@/lib/board/types";
import type { CardDescriptor, CardTheme } from "@/lib/card/types";
import { cardKey } from "@/lib/engine/deck";
import type { GameAction } from "@/lib/engine/types";
import type {
    PresidentPlayerView,
    PresidentView,
} from "@/lib/games/president/president";
import type { GameClientPayload } from "@/lib/models/game";
import { GameOverOverlay, nameOf, TurnBanner } from "./GameChrome";

interface Props {
    view: PresidentView;
    payload: GameClientPayload;
    currentUserId: string;
    deckTheme: CardTheme;
    boardTheme: BoardTheme;
    pending: boolean;
    onAction: (action: GameAction) => void;
}

/** Read the cards off a president `play` action (erased to GameAction). */
function actionCards(action: GameAction): readonly CardDescriptor[] {
    const cards = (action as { cards?: readonly CardDescriptor[] }).cards;
    return cards ?? [];
}

export function PresidentTable({
    view,
    payload,
    currentUserId,
    deckTheme,
    boardTheme,
    pending,
    onAction,
}: Props) {
    const t = useTranslations("game");

    const surface = boardTheme.surface;
    const surfaceStyle: CSSProperties = surface.overlay
        ? {
              background: `${surface.overlay}, ${surface.background}`,
              ...surface.style,
          }
        : { background: surface.background, ...surface.style };
    const zoneStyle: CSSProperties = {
        background: boardTheme.zone.background,
        border: `1px solid ${boardTheme.zone.borderColor}`,
        boxShadow: boardTheme.zone.boxShadow,
    };
    const badgeStyle: CSSProperties = {
        background: boardTheme.badge.background,
        color: boardTheme.badge.textColor,
    };

    const self = view.players.find((p) => p.playerId === currentUserId);
    const opponents = view.players.filter((p) => p.playerId !== currentUserId);
    const total = view.players.length;

    const placeLabel = (place: number | null): string | null => {
        if (place === null) return null;
        if (place === 1) return t("place_president");
        if (place === total) return t("place_asshole");
        return t("finished", { place });
    };

    const isYourTurn =
        !payload.isOver && view.currentPlayerId === currentUserId;
    const banner = payload.isOver
        ? t("game_over")
        : isYourTurn
          ? t("your_turn")
          : self
            ? t("waiting_for", {
                  name: nameOf(payload.players, view.currentPlayerId),
              })
            : t("spectating");

    const playActions = payload.legalActions.filter((a) => a.type === "play");
    const passAction = payload.legalActions.find((a) => a.type === "pass");

    const topPlay =
        view.pile.length > 0 ? view.pile[view.pile.length - 1] : undefined;

    function OpponentBadge({ p }: { p: PresidentPlayerView }) {
        const isTurn = !payload.isOver && p.playerId === view.currentPlayerId;
        const place = placeLabel(p.place);
        return (
            <div className="flex flex-col items-center gap-1">
                <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                        ...badgeStyle,
                        outline: isTurn
                            ? `2px solid ${boardTheme.accentColor}`
                            : undefined,
                    }}
                >
                    {p.name}
                </span>
                <div className="flex items-center gap-0.5">
                    {Array.from({
                        length: Math.min(p.handCount, 8),
                    }).map((_, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: positional face-down placeholders, no identity
                            key={i}
                            className="h-8 w-5 rounded-sm"
                            style={zoneStyle}
                        />
                    ))}
                </div>
                <span
                    className="text-[11px] font-semibold"
                    style={{ color: boardTheme.badge.textColor }}
                >
                    {place ?? t("cards_left", { n: p.handCount })}
                    {p.passed && !place ? ` · ${t("passed")}` : ""}
                </span>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-3xl xl:max-w-5xl flex-col gap-3">
            <TurnBanner label={banner} highlight={isYourTurn} />

            <div
                className="relative flex min-h-[60vh] flex-col gap-4 overflow-hidden rounded-2xl p-4 xl:p-6"
                style={surfaceStyle}
            >
                {/* Opponents */}
                <div className="flex flex-wrap items-start justify-around gap-4">
                    {opponents.map((p) => (
                        <OpponentBadge key={p.playerId} p={p} />
                    ))}
                </div>

                {/* Trick pile */}
                <div className="flex flex-1 items-center justify-center">
                    <div
                        className="flex min-h-32 min-w-64 flex-col items-center justify-center gap-2 rounded-xl px-6 py-4"
                        style={zoneStyle}
                    >
                        {topPlay ? (
                            <>
                                <div className="flex">
                                    {topPlay.cards.map((card, i) => (
                                        <div
                                            key={cardKey(card)}
                                            className="w-16"
                                            style={{
                                                marginLeft:
                                                    i === 0 ? 0 : "-2rem",
                                            }}
                                        >
                                            <Card
                                                card={card}
                                                theme={deckTheme}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <span
                                    className="text-xs font-bold"
                                    style={{
                                        color: boardTheme.badge.textColor,
                                    }}
                                >
                                    {nameOf(payload.players, topPlay.playerId)}
                                </span>
                            </>
                        ) : (
                            <span
                                className="text-sm"
                                style={{
                                    color: boardTheme.badge.textColor,
                                    opacity: 0.5,
                                }}
                            >
                                {t("in_play")}
                            </span>
                        )}
                    </div>
                </div>

                {/* Self hand */}
                {self?.hand ? (
                    <div className="flex flex-col items-center gap-3">
                        {self.place !== null && (
                            <span
                                className="rounded-full px-3 py-1 text-xs font-black"
                                style={{
                                    background: boardTheme.accentColor,
                                    color: "#0d0a05",
                                }}
                            >
                                {placeLabel(self.place)}
                            </span>
                        )}

                        <div className="flex flex-wrap justify-center gap-1">
                            {self.hand.map((card) => (
                                <div
                                    key={cardKey(card)}
                                    className="w-12 xl:w-14"
                                >
                                    <Card card={card} theme={deckTheme} />
                                </div>
                            ))}
                        </div>

                        {/* Legal moves */}
                        {isYourTurn && (
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                {playActions.map((action) => {
                                    const cards = actionCards(action);
                                    return (
                                        <button
                                            key={cards.map(cardKey).join("+")}
                                            type="button"
                                            onClick={() => onAction(action)}
                                            disabled={pending}
                                            className="flex items-center gap-1 rounded-lg px-2 py-1 disabled:opacity-50"
                                            style={{
                                                background:
                                                    "rgba(72,201,122,0.15)",
                                                border: "1px solid rgba(72,201,122,0.5)",
                                            }}
                                        >
                                            {cards.map((card) => (
                                                <div
                                                    key={cardKey(card)}
                                                    className="w-8"
                                                >
                                                    <Card
                                                        card={card}
                                                        theme={deckTheme}
                                                    />
                                                </div>
                                            ))}
                                        </button>
                                    );
                                })}
                                {passAction && (
                                    <button
                                        type="button"
                                        onClick={() => onAction(passAction)}
                                        disabled={pending}
                                        className="rounded-lg px-5 py-2 font-black text-sm disabled:opacity-50"
                                        style={{
                                            background: "rgba(224,64,64,0.15)",
                                            color: "#e04040",
                                            border: "1px solid rgba(224,64,64,0.5)",
                                        }}
                                    >
                                        {t("pass")}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <span
                        className="text-center text-sm"
                        style={{
                            color: boardTheme.badge.textColor,
                            opacity: 0.6,
                        }}
                    >
                        {t("spectating")}
                    </span>
                )}

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
