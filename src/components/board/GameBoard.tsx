"use client";

import type { CSSProperties } from "react";
import { Card } from "@/components/card/Card";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import type { BoardTheme, GameBoardProps } from "@/lib/board/types";
import { CARD_WIDTH_CLASS, HAND_OVERLAP_CLASS } from "@/lib/card/sizes";
import { getCardTheme } from "@/lib/card/themes";
import { FACE_DOWN_CARD } from "@/lib/card/utils";

function buildSurfaceStyle(theme: BoardTheme): CSSProperties {
    const { surface } = theme;
    if (surface.overlay) {
        return {
            background: `${surface.overlay}, ${surface.background}`,
            ...surface.style,
        };
    }
    return { background: surface.background, ...surface.style };
}

function buildZoneStyle(theme: BoardTheme): CSSProperties {
    const { zone } = theme;
    return {
        background: zone.background,
        border: `1px solid ${zone.borderColor}`,
        boxShadow: zone.boxShadow,
    };
}

function buildBadgeStyle(theme: BoardTheme): CSSProperties {
    return {
        background: theme.badge.background,
        color: theme.badge.textColor,
    };
}

export function GameBoard({
    theme = greenFeltTheme,
    players,
    playArea,
    handArea,
}: GameBoardProps) {
    const opponents = players.filter((p) => !p.isCurrentPlayer);
    const currentPlayer = players.find((p) => p.isCurrentPlayer);

    const surfaceStyle = buildSurfaceStyle(theme);
    const zoneStyle = buildZoneStyle(theme);
    const badgeStyle = buildBadgeStyle(theme);

    return (
        <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl"
            style={surfaceStyle}
        >
            {/* Opponents row */}
            <div className="flex items-start justify-around px-6 pt-4">
                {opponents.map((player) => (
                    <div
                        key={player.userId}
                        className="flex flex-col items-center gap-1"
                    >
                        <span
                            className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                            style={badgeStyle}
                        >
                            {player.username}
                        </span>
                        {/* Opponent hand — face-down backs in THAT player's deck style */}
                        <div className="flex">
                            {(["c1", "c2", "c3", "c4", "c5"] as const).map(
                                (slot) => (
                                    <div
                                        key={`${player.userId}-${slot}`}
                                        className={`${CARD_WIDTH_CLASS.sm} ${HAND_OVERLAP_CLASS.sm}`}
                                    >
                                        <Card
                                            card={FACE_DOWN_CARD}
                                            faceDown
                                            theme={getCardTheme(
                                                player.deckStyleId,
                                            )}
                                        />
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Center play area */}
            <div className="flex flex-1 items-center justify-center px-8 py-4">
                <div
                    className="flex min-h-44 w-full max-w-xl items-center justify-center rounded-xl backdrop-blur-sm xl:min-h-52 xl:max-w-3xl 2xl:min-h-56"
                    style={zoneStyle}
                >
                    {playArea ?? (
                        <span
                            className="text-sm"
                            style={{
                                color: theme.badge.textColor,
                                opacity: 0.4,
                            }}
                        >
                            Zone de jeu
                        </span>
                    )}
                </div>
            </div>

            {/* Current player hand */}
            <div className="flex flex-col items-center gap-2 px-6 pb-4">
                {currentPlayer && (
                    <span
                        className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                        style={badgeStyle}
                    >
                        {currentPlayer.username}
                    </span>
                )}
                <div
                    className="flex min-h-24 items-end justify-center gap-1 rounded-xl px-4 py-2 backdrop-blur-sm"
                    style={zoneStyle}
                >
                    {handArea ?? (
                        <span
                            className="text-sm"
                            style={{
                                color: theme.badge.textColor,
                                opacity: 0.4,
                            }}
                        >
                            Votre main
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
