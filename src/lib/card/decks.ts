import type { Rank, Suit } from "./types";

export interface DeckDefinition {
    id: string;
    name: string;
    suits: readonly Suit[];
    /** Low to high. */
    ranks: readonly Rank[];
    trumpCount?: number;
    hasFool?: boolean;
    jokers?: 0 | 1 | 2;
    /** Two copies of every suited card (Pinochle). */
    doubled?: boolean;
}

export const french52: DeckDefinition = {
    id: "french52",
    name: "French 52-card deck",
    suits: ["spades", "hearts", "diamonds", "clubs"],
    ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
};

export const french32: DeckDefinition = {
    id: "french32",
    name: "French 32-card deck",
    suits: ["spades", "hearts", "diamonds", "clubs"],
    ranks: ["7", "8", "9", "10", "J", "Q", "K", "A"],
};

/** French suit symbols stand in for the traditional tarot suits, for rendering. */
export const tarot78: DeckDefinition = {
    id: "tarot78",
    name: "French Tarot",
    suits: ["spades", "hearts", "diamonds", "clubs"],
    ranks: [
        "A",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "C",
        "Q",
        "K",
    ],
    trumpCount: 21,
    hasFool: true,
};

export const euchre24: DeckDefinition = {
    id: "euchre24",
    name: "Euchre deck",
    suits: ["spades", "hearts", "diamonds", "clubs"],
    ranks: ["9", "10", "J", "Q", "K", "A"],
};

export const pinochle48: DeckDefinition = {
    id: "pinochle48",
    name: "Pinochle deck",
    suits: ["spades", "hearts", "diamonds", "clubs"],
    ranks: ["9", "10", "J", "Q", "K", "A"],
    doubled: true,
};

export const DECKS: Record<string, DeckDefinition> = {
    french52,
    french32,
    tarot78,
    euchre24,
    pinochle48,
};
