import {
    type CardDescriptor,
    RANKS,
    type Rank,
    SUITS,
    type Suit,
} from "./types";

const PIP_INDEX: Partial<Record<string, number>> = {
    A: 1,
    J: 11,
    C: 12,
    Q: 13,
    K: 14,
};

/** Pip-layout lookup key — not a game ranking (those are per game). */
export function rankToPipIndex(rank: Rank): number {
    return PIP_INDEX[rank] ?? Number.parseInt(rank, 10);
}

/** Unique within a single-copy deck; doubled decks need a per-copy index on top. */
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

export function isSuit(value: unknown): value is Suit {
    return (
        typeof value === "string" &&
        (SUITS as readonly string[]).includes(value)
    );
}

export function isRank(value: unknown): value is Rank {
    return (
        typeof value === "string" &&
        (RANKS as readonly string[]).includes(value)
    );
}

/**
 * Strict check of an untrusted payload. `cardKey` is not a validator — it
 * stringifies, so `rank: 2` and `rank: "2"` would collide.
 */
export function isCardDescriptor(value: unknown): value is CardDescriptor {
    if (typeof value !== "object" || value === null) return false;
    const card = value as Record<string, unknown>;
    switch (card.type) {
        case "suited":
            return isSuit(card.suit) && isRank(card.rank);
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

/** Face of a card only ever rendered face-down (only the theme's back shows). */
export const FACE_DOWN_CARD: CardDescriptor = {
    type: "suited",
    suit: "spades",
    rank: "A",
};

export const SUIT_SYMBOL: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

/** Hand reading order: colours alternate so two red suits never sit side by side. */
export const SUIT_DISPLAY_ORDER: Record<Suit, number> = {
    spades: 0,
    hearts: 1,
    clubs: 2,
    diamonds: 3,
};

const FACE_RANKS: ReadonlySet<Rank> = new Set(["A", "J", "C", "Q", "K"]);

/** Localized face name (`rank_<R>` in the game dictionary), pips as digits. */
export function rankLabel(t: (key: string) => string, rank: Rank): string {
    return FACE_RANKS.has(rank) ? t(`rank_${rank}`) : rank;
}
