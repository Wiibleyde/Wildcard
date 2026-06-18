import type { ApplyResult, GameState, Player } from "./types";

/**
 * Engine-level rule helpers shared by every {@link GameModule}. These operate
 * on the engine's own primitives (seats, apply results) — the cross-game glue
 * that every reducer needs but none should re-implement.
 */

/**
 * Build a refused {@link ApplyResult}. Every module rejected illegal moves with
 * the same `{ ok: false, error: { code, message } }` shape; this is that shape,
 * once. `code` is machine-readable (e.g. "not_your_turn"), `message` human.
 */
export function fail<S extends GameState>(
    code: string,
    message: string,
): ApplyResult<S> {
    return { ok: false, error: { code, message } };
}

/**
 * Players sorted by seat (ascending). Seating, not array order, defines turn
 * order — seats can have gaps after a leaver — so any game that rotates turns
 * sorts through here.
 */
export function seatOrder(players: readonly Player[]): Player[] {
    return [...players].sort((a, b) => a.seat - b.seat);
}
