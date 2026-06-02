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
  /** Unicode symbol or short inline SVG string */
  symbol: string;
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
}
