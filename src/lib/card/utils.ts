import type { CardDescriptor, Rank } from "./types";

const PIP_INDEX: Partial<Record<string, number>> = {
    A: 1,
    J: 11,
    C: 12, // Cavalier
    Q: 13,
    K: 14,
};

/**
 * Returns the numeric key used to look up pip layouts in PIP_LAYOUTS.
 * A=1, 2–10 as-is, J=11, C=12, Q=13, K=14.
 *
 * Not for game logic — ranking rules are game-specific (e.g. Ace is
 * highest in Bataille but context-dependent in Belote/Coinche).
 */
export function rankToPipIndex(rank: Rank): number {
    return PIP_INDEX[rank] ?? Number.parseInt(rank, 10);
}

/**
 * Stable identity string for a descriptor — React keys, ref maps, logs.
 * Unique within a single deck (a deck never holds duplicate cards).
 */
export function cardKey(card: CardDescriptor): string {
    switch (card.type) {
        case "suited":
            return `suited-${card.suit}-${card.rank}`;
        case "trump":
            return `trump-${card.index}`;
        case "fool":
            return "fool";
        case "joker":
            return `joker-${card.variant ?? "red"}`;
    }
}

/**
 * Placeholder descriptor for cards rendered exclusively face-down (opponent
 * hands, deck-back thumbnails): only `theme.back` is shown, never this face.
 */
export const FACE_DOWN_CARD: CardDescriptor = {
    type: "suited",
    suit: "spades",
    rank: "A",
};
