"use client";

import { Card } from "@/components/card/Card";
import { getCardTheme } from "@/lib/card/themes";
import { FACE_DOWN_CARD } from "@/lib/card/utils";
import type { TableSeat } from "@/lib/games/table/types";

// Stable keys for the positional face-down placeholders.
const SEAT_BACK_IDS = ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7"];

interface TableSeatsProps {
    seats: readonly TableSeat[];
    deckStyleOf: (playerId: string) => string | undefined;
}

export function TableSeats({ seats, deckStyleOf }: TableSeatsProps) {
    if (seats.length === 0) return null;

    return (
        <div className="flex flex-wrap items-start justify-around gap-x-4 gap-y-2 sm:gap-4">
            {seats.map((seat) => (
                <SeatChip
                    key={seat.playerId}
                    seat={seat}
                    deckStyleId={deckStyleOf(seat.playerId)}
                />
            ))}
        </div>
    );
}

function SeatChip({
    seat,
    deckStyleId,
}: {
    seat: TableSeat;
    deckStyleId: string | undefined;
}) {
    const seatTheme = getCardTheme(deckStyleId);
    const active = seat.isTurn;

    return (
        <div className="flex flex-col items-center gap-1.5">
            <div
                className="flex items-center gap-2 rounded-full border-nb px-3.5 py-1.5"
                style={{
                    background: active ? "var(--gold)" : "var(--panel-d)",
                    borderColor: "var(--ink)",
                    boxShadow: "0 4px 0 var(--ink)",
                }}
            >
                <span
                    className="font-display text-sm leading-none"
                    style={{ color: active ? "var(--ink)" : "var(--cream)" }}
                >
                    {seat.name}
                </span>
                {seat.handCount !== null && (
                    <span
                        className="font-pixel text-wc-micro leading-none"
                        style={{
                            color: active ? "#6a4f14" : "var(--muted)",
                        }}
                    >
                        {seat.handCount}
                    </span>
                )}
            </div>
            {seat.handCount !== null && seat.handCount > 0 && (
                <div className="flex">
                    {SEAT_BACK_IDS.slice(0, seat.handCount).map((id) => (
                        <div
                            key={id}
                            className="-ml-3 w-6 first:ml-0 xl:-ml-4 xl:w-8"
                            style={{
                                filter: "drop-shadow(0 3px 0 rgba(11,18,32,0.35))",
                            }}
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
                    className="font-display text-wc-tag xl:text-xs"
                    style={{ color: active ? "var(--gold)" : "var(--muted)" }}
                >
                    {seat.status}
                </span>
            )}
        </div>
    );
}
