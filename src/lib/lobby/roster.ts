export interface SeatRow {
    userId: string;
    username: string;
    seat: number;
}

export interface SpectatorRow {
    userId: string;
    username: string;
}

export type Role = "player" | "spectator";

export type Slot =
    | { kind: "human"; username: string; userId: string }
    | { kind: "bot"; label: string }
    | null;

/** A `room_players` row as selected by the lobby (`user_id, seat, role`). */
export interface MemberRow {
    user_id: string;
    seat: number | null;
    role: string;
}

function isSeatedPlayer(row: MemberRow): row is MemberRow & { seat: number } {
    return row.role === "player" && row.seat !== null;
}

export function splitRoster(
    rows: readonly MemberRow[],
    nameOf: ReadonlyMap<string, string>,
    /** Localized name for a member without a portal pseudo. */
    fallbackName: (userId: string) => string,
): { seats: SeatRow[]; spectators: SpectatorRow[] } {
    const username = (id: string) => nameOf.get(id) ?? fallbackName(id);
    return {
        seats: rows.filter(isSeatedPlayer).map((r) => ({
            userId: r.user_id,
            seat: r.seat,
            username: username(r.user_id),
        })),
        spectators: rows
            .filter((r) => r.role === "spectator")
            .map((r) => ({ userId: r.user_id, username: username(r.user_id) })),
    };
}
