import type { GameEvent } from "@/lib/engine/types";
import type { GameLogEntry } from "@/lib/models/game";

export interface GameLogLine {
    readonly id: string;
    readonly text: string;
}

/**
 * Newest first, across entries AND within one, so a step's last event
 * ("game over") sits on top of its group. `null` lines are hidden.
 */
export function buildLogLines(
    log: readonly GameLogEntry[],
    lineOf: (event: GameEvent) => string | null,
): GameLogLine[] {
    return [...log].reverse().flatMap((entry) =>
        entry.events
            .flatMap((event, eventIndex) => {
                const text = lineOf(event);
                return text ? [{ id: `${entry.seq}.${eventIndex}`, text }] : [];
            })
            .reverse(),
    );
}
