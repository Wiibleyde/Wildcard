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
  | "Q"
  | "K";

/** Ranks that have a center illustration slot */
export type FaceRank = "A" | "J" | "Q" | "K";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: Rank[] = [
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
  /** Default text color (rank numbers) */
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
   *   hearts: { Q: <img src="/themes/gothic/queen-hearts.png" alt="" /> },
   * }
   */
  faceArtwork?: Partial<
    Record<Suit, Partial<Record<FaceRank, string | ReactElement>>>
  >;
}
