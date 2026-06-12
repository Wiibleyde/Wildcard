"use client";

import { Card } from "@/components/card/Card";
import { BoardPill } from "@/components/ui/BoardPill";
import { buildSurfaceStyle, buildZoneStyle } from "@/lib/board/styles";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import type {
    BoardPlayer,
    BoardTheme,
    GameBoardProps,
} from "@/lib/board/types";
import { CARD_WIDTH_CLASS, HAND_OVERLAP_CLASS } from "@/lib/card/sizes";
import { getCardTheme } from "@/lib/card/themes";
import { FACE_DOWN_CARD } from "@/lib/card/utils";

/** Face-down cards drawn for each opponent — purely decorative. */
const OPPONENT_HAND_SLOTS = ["c1", "c2", "c3", "c4", "c5"] as const;

function OpponentSeat({
    player,
    theme,
}: {
    player: BoardPlayer;
    theme: BoardTheme;
}) {
    return (
        <div className="flex flex-col items-center gap-1">
            <BoardPill theme={theme}>{player.username}</BoardPill>
            {/* Opponent hand — face-down backs in THAT player's deck style */}
            <div className="flex">
                {OPPONENT_HAND_SLOTS.map((slot) => (
                    <div
                        key={`${player.userId}-${slot}`}
                        className={`${CARD_WIDTH_CLASS.sm} ${HAND_OVERLAP_CLASS.sm}`}
                    >
                        <Card
                            card={FACE_DOWN_CARD}
                            faceDown
                            theme={getCardTheme(player.deckStyleId)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function ZonePlaceholder({ text, theme }: { text: string; theme: BoardTheme }) {
    return (
        <span
            className="text-sm xl:text-base"
            style={{ color: theme.badge.textColor, opacity: 0.4 }}
        >
            {text}
        </span>
    );
}

export function GameBoard({
    theme = greenFeltTheme,
    players,
    playArea,
    handArea,
    playAreaPlaceholder,
    handPlaceholder,
}: GameBoardProps) {
    const opponents = players.filter((p) => !p.isCurrentPlayer);
    const currentPlayer = players.find((p) => p.isCurrentPlayer);

    const zoneStyle = buildZoneStyle(theme);

    return (
        <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl"
            style={buildSurfaceStyle(theme)}
        >
            {/* Opponents row */}
            <div className="flex flex-wrap items-start justify-around gap-x-4 gap-y-2 px-3 pt-3 sm:px-6 sm:pt-4">
                {opponents.map((player) => (
                    <OpponentSeat
                        key={player.userId}
                        player={player}
                        theme={theme}
                    />
                ))}
            </div>

            {/* Center play area */}
            <div className="flex flex-1 items-center justify-center px-3 py-3 sm:px-8 sm:py-4">
                <div
                    className="flex min-h-36 w-full max-w-xl items-center justify-center rounded-xl backdrop-blur-sm sm:min-h-44 lg:max-w-2xl xl:min-h-52 xl:max-w-3xl 2xl:min-h-60 2xl:max-w-5xl"
                    style={zoneStyle}
                >
                    {playArea ??
                        (playAreaPlaceholder && (
                            <ZonePlaceholder
                                text={playAreaPlaceholder}
                                theme={theme}
                            />
                        ))}
                </div>
            </div>

            {/* Current player hand */}
            <div className="flex flex-col items-center gap-2 px-2 pb-3 sm:px-6 sm:pb-4">
                {currentPlayer && (
                    <BoardPill theme={theme}>
                        {currentPlayer.username}
                    </BoardPill>
                )}
                <div
                    className="flex min-h-24 max-w-full items-end justify-center gap-1 rounded-xl px-2 py-2 backdrop-blur-sm sm:px-4 xl:min-h-28"
                    style={zoneStyle}
                >
                    {handArea ??
                        (handPlaceholder && (
                            <ZonePlaceholder
                                text={handPlaceholder}
                                theme={theme}
                            />
                        ))}
                </div>
            </div>
        </div>
    );
}
