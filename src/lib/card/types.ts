import type { CSSProperties, ReactElement } from "react";

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

/** 1 = le Petit, 21 = le Monde. */
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

export type CardDescriptor =
    | { type: "suited"; suit: Suit; rank: Rank }
    | { type: "trump"; index: TrumpIndex } // Tarot atouts I–XXI
    | { type: "fool" } // Tarot L'Excuse
    | { type: "joker"; variant?: JokerVariant };

export type SuitedCard = Extract<CardDescriptor, { type: "suited" }>;

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];

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
    /** A glyph, or an inline `<svg>`/`<img>` for brand themes. */
    symbol: string | ReactElement;
    color: string;
    symbolStyle?: CSSProperties;
}

export interface CardBorder {
    color: string;
    effect: "solid" | "glow";
    /** px; defaults to the 2.5px ink stroke. */
    width?: number;
    glowColor?: string;
    /** px; defaults to 8. */
    glowSize?: number;
    /** Overrides the computed glow. */
    boxShadow?: string;
}

/**
 * Two independent layers: `fill` covers the whole face, `center` replaces the
 * pips/face. Corners stay on by default so the card remains readable.
 */
export interface CardArtwork {
    fill?: string | ReactElement;
    objectFit?: "cover" | "contain";
    /** Default true; turn off only when the fill itself shows rank and suit. */
    showCorners?: boolean;
    /** Default: false when `fill` is set, true otherwise. */
    showCenter?: boolean;
    /** Overlay color painted over the fill. */
    tint?: string;
    center?: string | ReactElement;
}

export type CardEffectType = "shimmer" | "foil" | "holographic" | "sparkle";

export interface CardEffect {
    type: CardEffectType;
    color?: string;
    /** Multiplier; 1 is the default speed. */
    speed?: number;
}

/** Referenced by id, not code, so decks stored as JSON can pick one too. */
export type PlayAnimationTemplateId = "simple" | "flip" | "arc";

export interface PlayAnimationRef {
    template: PlayAnimationTemplateId;
    /** Seconds; overrides the template's default. */
    duration?: number;
}

export interface ThemeFont {
    /** The caller loads the @font-face. */
    family: string;
    rankWeight?: number | string;
    rankItalic?: boolean;
    rankStyle?: CSSProperties;
}

export interface BrandInfo {
    name: string;
    logo?: string | ReactElement;
    /** Shown on the back, e.g. "2025 S1". */
    edition?: string;
    tagline?: string;
}

/** Monetization tier, common → ethereal (rarest); drives badges and unlocks. */
export type ThemeTier =
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mystical"
    | "ethereal";

export interface CardTheme {
    id: string;
    name: string;
    tier: ThemeTier;

    suits: Record<Suit, SuitStyle>;
    backgroundColor: string;
    /** For labels that don't take the suit color. */
    textColor: string;
    border: CardBorder;

    back: {
        color: string;
        /** CSS `background` shorthand painted over `color`. */
        pattern?: string;
        /** Replaces color + pattern. */
        artwork?: string | ReactElement;
        emblem?: string | ReactElement;
        effects?: CardEffect[];
    };

    /** Suited cards: `suited[suit][rank]` wins over `suitDefault[suit]`. */
    artwork?: {
        suited?: Partial<Record<Suit, Partial<Record<Rank, CardArtwork>>>>;
        suitDefault?: Partial<Record<Suit, CardArtwork>>;
        trump?: Partial<Record<TrumpIndex, CardArtwork>>;
        fool?: CardArtwork;
        joker?: Partial<Record<JokerVariant, CardArtwork>>;
    };

    effects?: CardEffect[];
    /** Omitted ⇒ the "simple" template. */
    playAnimation?: PlayAnimationRef;
    font?: ThemeFont;
    /** Tarot trump/fool labels; falls back to `textColor`. */
    trumpColor?: string;
    /** Brand-collaboration decks only. */
    brand?: BrandInfo;
}
