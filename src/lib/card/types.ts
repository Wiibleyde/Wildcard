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

// ── Theme building blocks ─────────────────────────────────────────────────────

export interface SuitStyle {
    /**
     * Suit symbol rendered at various sizes across the card.
     * - `string` — unicode char (e.g. `"♠"`) for simple themes
     * - `ReactElement` — inline `<svg>` or `<img>` for brand/custom themes
     */
    symbol: string | ReactElement;
    /** CSS color value */
    color: string;
    /** Extra CSS applied to every symbol span — useful for text-shadow glows */
    symbolStyle?: CSSProperties;
}

export interface CardBorder {
    color: string;
    effect: "solid" | "glow";
    glowColor?: string;
    /** Glow spread in pixels (default 8) */
    glowSize?: number;
    /** Full CSS box-shadow string — overrides the computed glow when set */
    boxShadow?: string;
}

/**
 * Per-card artwork slot.
 *
 * Two independent layers:
 * - `fill`   — full-bleed image/element covering the entire card face
 * - `center` — custom center illustration (replaces pip layout / face rank+symbol)
 *
 * Corners are always shown by default so the card stays readable; set
 * `showCorners: false` for artistic cards where the fill encodes rank/suit itself.
 */
export interface CardArtwork {
    /** Full-bleed layer — image URL string, inline SVG, or any ReactElement */
    fill?: string | ReactElement;
    objectFit?: "cover" | "contain";
    /** Keep rank+suit corners over the fill (default: true) */
    showCorners?: boolean;
    /**
     * Keep the center pip/face illustration over the fill.
     * Default: false when `fill` is set (artwork takes over), true otherwise.
     */
    showCenter?: boolean;
    /** CSS color overlay painted on top of the fill, e.g. "rgba(0,0,0,0.25)" */
    tint?: string;
    /**
     * Custom center illustration — replaces pip grid and face rank+symbol.
     * Has no effect on corner labels.
     */
    center?: string | ReactElement;
}

/** Visual effect overlaid on a card via CSS animation */
export type CardEffectType = "shimmer" | "foil" | "holographic" | "sparkle";

export interface CardEffect {
    type: CardEffectType;
    /** Accent color fed into the effect as a CSS custom property */
    color?: string;
    /** Animation speed multiplier — 1 is the default */
    speed?: number;
}

/**
 * Built-in play-animation templates. Implementations live in the
 * `PLAY_ANIMATIONS` registry (`src/lib/card/animations.ts`) — decks reference
 * a template by id instead of shipping animation code, so ECA/studio decks
 * stored as JSON can pick one too.
 */
export type PlayAnimationTemplateId = "simple" | "flip" | "arc";

/** A deck's pick of entry animation for cards it plays to the table. */
export interface PlayAnimationRef {
    template: PlayAnimationTemplateId;
    /** Seconds — overrides the template's default duration */
    duration?: number;
}

export interface ThemeFont {
    /** CSS font-family string — caller is responsible for @font-face loading */
    family: string;
    rankWeight?: number | string;
    rankItalic?: boolean;
    /** Additional CSS applied to corner rank/index labels */
    rankStyle?: CSSProperties;
}

export interface BrandInfo {
    name: string;
    /** Brand logo — image URL or ReactElement */
    logo?: string | ReactElement;
    /** Edition/season label displayed on the back, e.g. "2025 S1" */
    edition?: string;
    /** Short tagline shown on the back */
    tagline?: string;
}

/**
 * Monetization tier — drives UI badges and unlock flows.
 * - common    — included for all users
 * - uncommon  — slightly rare
 * - rare      — rare
 * - epic      — quite rare
 * - legendary — very rare
 * - mystical  — extremely rare
 * - ethereal  — quasi-unique (top tier)
 */
export type ThemeTier =
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mystical"
    | "ethereal";

// ── CardTheme ─────────────────────────────────────────────────────────────────

export interface CardTheme {
    id: string;
    name: string;
    /** Monetization tier */
    tier: ThemeTier;

    suits: Record<Suit, SuitStyle>;
    /** Card face background CSS color */
    backgroundColor: string;
    /** Default text color for labels that don't derive color from suit */
    textColor: string;
    border: CardBorder;

    /** Card back design */
    back: {
        /** Base fill color */
        color: string;
        /** CSS `background` shorthand painted over `color` (pattern/gradient) */
        pattern?: string;
        /** Full-bleed artwork — highest priority, replaces color+pattern */
        artwork?: string | ReactElement;
        /** Central emblem rendered on the back */
        emblem?: string | ReactElement;
        effects?: CardEffect[];
    };

    /**
     * Per-card artwork overrides.
     *
     * Resolution order for suited cards (first match wins):
     *   artwork.suited[suit][rank]   ← most specific
     *   artwork.suitDefault[suit]
     *   (no match — render pips/face normally)
     */
    artwork?: {
        /** Indexed by suit → rank */
        suited?: Partial<Record<Suit, Partial<Record<Rank, CardArtwork>>>>;
        /** Default for every card of a suit — per-rank entries take precedence */
        suitDefault?: Partial<Record<Suit, CardArtwork>>;
        trump?: Partial<Record<TrumpIndex, CardArtwork>>;
        fool?: CardArtwork;
        joker?: Partial<Record<JokerVariant, CardArtwork>>;
    };

    /** Visual effects applied to all card faces */
    effects?: CardEffect[];
    /**
     * Entry animation when a card from this deck lands on the table.
     * Omitted → the "simple" template.
     */
    playAnimation?: PlayAnimationRef;
    /** Custom typography — caller must load the font */
    font?: ThemeFont;

    /** Accent color for tarot trump and fool labels (falls back to textColor) */
    trumpColor?: string;

    /** Brand/partner metadata — set on brand-collaboration decks */
    brand?: BrandInfo;
}
