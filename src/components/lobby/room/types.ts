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
