/**
 * Realtime topic names shared by the server (which broadcasts on them) and the
 * client hooks (which subscribe) — one definition so the two never drift.
 */

/** Per-game doorbell: carries `{ version }` after every committed move. */
export function gameTopic(gameId: string): string {
    return `game:${gameId}`;
}

/** Broadcast event fired on {@link gameTopic} when `games.version` advances. */
export const GAME_VERSION_EVENT = "version";

/** Payload of {@link GAME_VERSION_EVENT}. Public meta only — never state. */
export interface GameVersionSignal {
    readonly version: number;
}
