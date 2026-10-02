// Shared by the server (broadcasts) and the client hooks (subscribes).

/** Per-game doorbell, `{ version }` after every committed move. */
export function gameTopic(gameId: string): string {
    return `game:${gameId}`;
}

export const GAME_VERSION_EVENT = "version";

/** Public meta only — never state. */
export interface GameVersionSignal {
    readonly version: number;
}

/** In-game chat, separate from the doorbell so chatter never refetches the board. */
export function chatTopic(gameId: string): string {
    return `chat:game:${gameId}`;
}

export const CHAT_MESSAGE_EVENT = "message";

export function roomTopic(roomId: string): string {
    return `room:${roomId}`;
}

export function ticketTopic(userId: string): string {
    return `mm:${userId}`;
}

/** Own `player_xp` row, watched on the game-over screen. */
export function xpTopic(userId: string): string {
    return `xp-gameover:${userId}`;
}
