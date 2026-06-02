import type { Rank, Suit } from "./types";

export interface DeckDefinition {
  id: string;
  name: string;
  /** Valid suits in this deck */
  suits: readonly Suit[];
  /** Valid ranks for suited cards — ordered low to high */
  ranks: readonly Rank[];
  /** Number of trump (atout) cards — 21 for French Tarot */
  trumpCount?: number;
  /** Whether the deck includes a Fool card (L'Excuse in French Tarot) */
  hasFool?: boolean;
  /** Number of joker cards (0, 1, or 2) */
  jokers?: 0 | 1 | 2;
  /**
   * Whether each suit×rank combination is duplicated.
   * True for Pinochle, which uses two copies of every card.
   */
  doubled?: boolean;
}

/**
 * Standard French 52-card deck.
 * Used for: Bataille, Président, Trou du Cul, Kems.
 */
export const french52: DeckDefinition = {
  id: "french52",
  name: "French 52-card deck",
  suits: ["spades", "hearts", "diamonds", "clubs"],
  ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
};

/**
 * French 32-card deck — 7 through Ace (2–6 removed).
 * Used for: Belote, Coinche, Piquet.
 * Equivalent to the Skat deck when French suits are used.
 */
export const french32: DeckDefinition = {
  id: "french32",
  name: "French 32-card deck",
  suits: ["spades", "hearts", "diamonds", "clubs"],
  ranks: ["7", "8", "9", "10", "J", "Q", "K", "A"],
};

/**
 * French Tarot — 78 cards.
 * 4 suits × 14 ranks (A–10, Valet/J, Cavalier/C, Dame/Q, Roi/K)
 * + 21 Atouts (trumps I–XXI) + L'Excuse (Fool).
 *
 * Note: suits in French Tarot are traditionally Bâtons, Épées, Coupes,
 * Deniers — represented here with standard French suit symbols for
 * rendering compatibility.
 */
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

/**
 * Euchre deck — 24 cards (9, 10, J, Q, K, A × 4 suits).
 * Popular in North American and British trick-taking games.
 * The Jack of the trump suit (Right Bower) and its same-color
 * counterpart (Left Bower) take on special roles at game level.
 */
export const euchre24: DeckDefinition = {
  id: "euchre24",
  name: "Euchre deck",
  suits: ["spades", "hearts", "diamonds", "clubs"],
  ranks: ["9", "10", "J", "Q", "K", "A"],
};

/**
 * Pinochle deck — 48 cards.
 * Two copies of 9, 10, J, Q, K, A × 4 suits (doubled = true).
 * Used for Pinochle and Bezique variants.
 */
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
