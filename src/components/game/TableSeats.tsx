"use client";

import { Card } from "@/components/card/Card";
import { Avatar } from "@/components/ui/Avatar";
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
        <div className="flex flex-wrap items-start justify-around gap-x-4 gap-y-3 sm:gap-4">
            {seats.map((seat) => (
                <SeatPlate
                    key={seat.playerId}
                    seat={seat}
                    deckStyleId={deckStyleOf(seat.playerId)}
                />
            ))}
        </div>
    );
}

/** An opponent's name plate: avatar, name, status, and their hand face down. */
function SeatPlate({
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
                className={`flex items-center gap-2 rounded-[14px] border-2 bg-wc-panel-d py-1.5 pr-3 pl-1.5 transition-transform ${
                    active
                        ? "-translate-y-0.5 border-wc-orange"
                        : "border-wc-edge"
                }`}
                style={{ boxShadow: "0 4px 0 var(--drop)" }}
            >
                <Avatar name={seat.name} size={30} />
                <div className="min-w-0 leading-tight">
                    <p className="max-w-32 truncate text-sm font-extrabold">
                        {seat.name}
                    </p>
                    {seat.status && (
                        <p
                            className="max-w-32 truncate text-wc-label font-bold"
                            style={{
                                color: active
                                    ? "var(--orange)"
                                    : "var(--muted)",
                            }}
                        >
                            {seat.status}
                        </p>
                    )}
                </div>
                {seat.handCount !== null && (
                    <span className="stamp bg-wc-panel-d2 text-wc-muted">
                        {seat.handCount}
                    </span>
                )}
            </div>
            {seat.handCount !== null && seat.handCount > 0 && (
                <div className="flex">
                    {SEAT_BACK_IDS.slice(0, seat.handCount).map((id) => (
                        <div
                            key={id}
                            className="-ml-3.5 w-6 first:ml-0 xl:-ml-4.5 xl:w-8"
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
        </div>
    );
}
