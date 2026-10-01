import { type CardDescriptor, RANKS, type Rank, SUITS } from "./types";

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
 * Stable identity string for a descriptor — React keys, ref maps, equality
 * checks, logs. The single source of truth for card identity: the engine
 * re-exports it from `@/lib/engine/deck`.
 *
 * Unique within a single-copy deck. Doubled decks (Pinochle) hold two cards
 * per key — callers needing per-copy identity must add their own index.
 */
export function cardKey(card: CardDescriptor): string {
    switch (card.type) {
        case "suited":
            return `s:${card.suit}:${card.rank}`;
        case "trump":
            return `t:${card.index}`;
        case "fool":
            return "fool";
        case "joker":
            return `j:${card.variant ?? "red"}`;
    }
}

/**
 * Strict runtime check of an untrusted value (client action payload) against
 * {@link CardDescriptor}: exact field types, known suits/ranks, integer trump
 * index. `cardKey` alone is NOT a validator — it stringifies, so `rank: 2`
 * and `rank: "2"` collide. Game modules must still store the canonical card
 * taken from the hand, never the client object.
 */
export function isCardDescriptor(value: unknown): value is CardDescriptor {
    if (typeof value !== "object" || value === null) return false;
    const card = value as Record<string, unknown>;
    switch (card.type) {
        case "suited":
            return (
                typeof card.suit === "string" &&
                (SUITS as readonly string[]).includes(card.suit) &&
                typeof card.rank === "string" &&
                (RANKS as readonly string[]).includes(card.rank)
            );
        case "trump":
            return (
                typeof card.index === "number" &&
                Number.isInteger(card.index) &&
                card.index >= 1 &&
                card.index <= 21
            );
        case "fool":
            return true;
        case "joker":
            return (
                card.variant === undefined ||
                card.variant === "red" ||
                card.variant === "black"
            );
        default:
            return false;
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
