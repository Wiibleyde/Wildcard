"use client";

import { Card } from "@/components/card/Card";
import { BoardPill } from "@/components/ui/BoardPill";
import type { BoardTheme } from "@/lib/board/types";
import { getCardTheme } from "@/lib/card/themes";
import { FACE_DOWN_CARD } from "@/lib/card/utils";
import type { TableSeat } from "@/lib/games/table/types";

/** Cap of face-down mini cards drawn under a seat — the count never overflows. */
const SEAT_HAND_MAX = 8;

interface TableSeatsProps {
    seats: readonly TableSeat[];
    boardTheme: BoardTheme;
    /** Resolves a seat's deck style for its face-down mini cards. */
    deckStyleOf: (playerId: string) => string | undefined;
}

/** Opponent chips across the top of the board: name, hand size, status. */
export function TableSeats({
    seats,
    boardTheme,
    deckStyleOf,
}: TableSeatsProps) {
    if (seats.length === 0) return null;

    return (
        <div className="flex flex-wrap items-start justify-around gap-x-4 gap-y-2 sm:gap-4">
            {seats.map((seat) => (
                <SeatChip
                    key={seat.playerId}
                    seat={seat}
                    boardTheme={boardTheme}
                    deckStyleId={deckStyleOf(seat.playerId)}
                />
            ))}
        </div>
    );
}

function SeatChip({
    seat,
    boardTheme,
    deckStyleId,
}: {
    seat: TableSeat;
    boardTheme: BoardTheme;
    deckStyleId: string | undefined;
}) {
    const seatTheme = getCardTheme(deckStyleId);

    return (
        <div className="flex flex-col items-center gap-1">
            <BoardPill theme={boardTheme} outlined={seat.isTurn}>
                {seat.name}
            </BoardPill>
            {seat.handCount !== null && (
                <div className="flex">
                    {Array.from({
                        length: Math.min(seat.handCount, SEAT_HAND_MAX),
                    }).map((_, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: positional face-down placeholders, no identity
                            key={i}
                            className="w-6 first:ml-0 -ml-3 xl:w-8 xl:-ml-4"
                        >
                            <Card
                                card={FACE_DOWN_CARD}
                                faceDown
                                theme={seatTheme}
                            />
                        </div>
                    ))}
                </div>
            )}
            {seat.status && (
                <span
                    className="text-[11px] font-semibold xl:text-xs"
                    style={{ color: boardTheme.badge.textColor }}
                >
                    {seat.status}
                </span>
            )}
        </div>
    );
}
