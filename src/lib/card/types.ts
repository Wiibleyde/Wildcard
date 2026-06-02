import type { ReactElement } from "react";

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "C" // Cavalier — French Tarot only
  | "Q"
  | "K";

/** Ranks that have a center illustration slot (non-pip face cards + Ace) */
export type FaceRank = "A" | "J" | "C" | "Q" | "K";

/** Tarot trump index — 1 (Petit) through 21 (Le Monde) */
export type TrumpIndex =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21;

export type JokerVariant = "red" | "black";

/**
 * Discriminated union covering every card across all supported deck types.
 * Use this as the canonical card identity in game state and UI props.
 */
export type CardDescriptor =
  | { type: "suited"; suit: Suit; rank: Rank }
  | { type: "trump"; index: TrumpIndex } // Tarot atouts I–XXI
  | { type: "fool" } // Tarot L'Excuse
  | { type: "joker"; variant?: JokerVariant };

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];

/** Universe of all ranks across all supported deck types */
export const RANKS: readonly Rank[] = [
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
];

export interface SuitStyle {
  /**
   * Suit symbol rendered at various sizes across the card.
   * - `string` — unicode char (e.g. `"♠"`) for the built-in Classic theme
   * - `ReactElement` — inline `<svg>` or `<img>` for custom/paid themes
   */
  symbol: string | ReactElement;
  /** CSS color value */
  color: string;
}

export interface CardBorder {
  /** CSS color value */
  color: string;
  /** Visual effect — "glow" support planned */
  effect: "solid" | "glow";
  /** CSS color for glow effect */
  glowColor?: string;
  /** Glow spread in pixels (default 8) */
  glowSize?: number;
}

export interface CardTheme {
  id: string;
  name: string;
  isPaid: boolean;
  suits: Record<Suit, SuitStyle>;
  /** Card face background CSS color */
  backgroundColor: string;
  /** Default text color (rank and index labels) */
  textColor: string;
  border: CardBorder;
  /** Card back solid background CSS color */
  backColor: string;
  /** Optional CSS `background` shorthand for the card back pattern */
  backPattern?: string;
  /**
   * Custom center artwork for Ace and face cards, indexed by suit then rank.
   * Omitted entries fall back to the default rank + symbol display.
   *
   * @example
   * faceArtwork: {
   *   spades: { K: <img src="/themes/gothic/king-spades.png" alt="" /> },
   * }
   */
  faceArtwork?: Partial<
    Record<Suit, Partial<Record<FaceRank, string | ReactElement>>>
  >;
  /**
   * Color applied to trump and fool corner labels.
   * Falls back to `textColor` when omitted.
   */
  trumpColor?: string;
  /**
   * Custom center artwork for tarot trump cards (atouts), indexed by trump
   * number (1–21). Omitted entries display the roman numeral centered.
   */
  trumpArtwork?: Partial<Record<TrumpIndex, string | ReactElement>>;
  /**
   * Custom center artwork for the Fool card (tarot L'Excuse).
   * Defaults to a ★ symbol when omitted.
   */
  foolArtwork?: string | ReactElement;
  /**
   * Custom center artwork for joker cards, indexed by variant.
   * Defaults to a ★ symbol when omitted.
   */
  jokerArtwork?: Partial<Record<JokerVariant, string | ReactElement>>;
}
