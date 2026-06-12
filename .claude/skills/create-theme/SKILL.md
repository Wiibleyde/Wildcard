---
name: create-theme
description: Scaffold a new CardTheme file in src/lib/card/themes/. Use when the user asks to create a card theme, a custom deck theme, a brand collab theme, or a new visual style for cards.
argument-hint: `/create-theme [theme-id]` (kebab-case, e.g. `gothic-night`). If no theme-id is provided, the skill should ask the user for it before proceeding.
---

# create-theme

Scaffold a typed `CardTheme` file for the Wildcard card system.

## Instructions

1. Read the args passed to the skill (e.g. `/create-theme gothic-night` → id = `gothic-night`).  
   If no args, ask the user for the theme id (kebab-case) before proceeding.

2. Ask the user (in a single message) for the following, offering sensible defaults:
   - **Tier** — `common | uncommon | rare | epic | legendary | mystical | ethereal` (default: `rare`)
   - **Brand name** — only for brand-collab decks; skip otherwise
   - **Card face** — background color + default text color
   - **Border** — color + effect (`solid | glow`); if glow, also glowColor
   - **Suits** — color for black suits (♠♣) and color for red suits (♥♦); symbols stay as unicode unless the user specifies SVG/image
   - **Back** — base color + optional pattern description (e.g. "diagonal stripes", "diamond lattice")
   - **Effects** — comma-separated list of `shimmer | foil | holographic | sparkle` (optional)
   - **Play animation** — template used when a card of this deck lands on the table: `simple | flip | arc` (optional; omitting it means `simple`). Templates live in `src/lib/card/animations.ts` (`PLAY_ANIMATIONS`)
   - **Font** — CSS font-family (optional; user must load the font themselves)

3. Once you have the answers, create the file at:
   ```
   src/lib/card/themes/<id>.ts
   ```

4. The file must:
   - Import only `import type { CardTheme } from "@/lib/card/types";`
   - Export a single named const matching the camelCase version of the id  
     e.g. `gothic-night` → `export const gothicNight: CardTheme = { ... }`
   - Have **zero** unused fields — omit optional fields that weren't requested
   - Have **zero** comments unless the user explicitly requested them
   - Pass `bun run lint` — match the project's Biome/TypeScript conventions

5. After creating the file, remind the user to:
   - Register the theme in `src/lib/card/themes/index.ts` (the `THEMES` registry)
   - Load any custom font via `<link>` or `@font-face` in the app layout

## CardTheme reference

```ts
interface CardTheme {
  id: string;                   // kebab-case, matches filename
  name: string;                 // Display name shown in the UI
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mystical" | "ethereal";

  suits: Record<"spades"|"hearts"|"diamonds"|"clubs", {
    symbol: string;             // Unicode char e.g. "♠" — or ReactElement for SVG
    color: string;              // CSS color
    symbolStyle?: CSSProperties; // Optional: text-shadow, filter, etc.
  }>;

  backgroundColor: string;      // Card face background
  textColor: string;            // Default label color (not suit-derived)

  border: {
    color: string;
    effect: "solid" | "glow";
    glowColor?: string;         // Required when effect: "glow"
    glowSize?: number;          // px — default 8
    boxShadow?: string;         // Full CSS override, takes priority
  };

  back: {
    color: string;
    pattern?: string;           // CSS background shorthand (gradient/repeating-*)
    artwork?: string | ReactElement; // Full-bleed image URL
    emblem?: string | ReactElement;  // Central symbol on the back
    effects?: CardEffect[];
  };

  // All optional below this line
  artwork?: {
    suited?: Partial<Record<Suit, Partial<Record<Rank, CardArtwork>>>>;
    suitDefault?: Partial<Record<Suit, CardArtwork>>;
    trump?: Partial<Record<TrumpIndex, CardArtwork>>;
    fool?: CardArtwork;
    joker?: Partial<Record<JokerVariant, CardArtwork>>;
  };

  effects?: Array<{
    type: "shimmer" | "foil" | "holographic" | "sparkle";
    color?: string;
    speed?: number;
  }>;

  playAnimation?: {             // Entry animation when a card lands on the table
    template: "simple" | "flip" | "arc";  // Registry: src/lib/card/animations.ts
    duration?: number;          // Seconds — overrides the template default
  };

  font?: {
    family: string;             // CSS font-family
    rankWeight?: number | string;
    rankItalic?: boolean;
    rankStyle?: CSSProperties;
  };

  trumpColor?: string;          // Accent for tarot trump/fool labels

  brand?: {                     // Only for brand-collab decks
    name: string;
    logo?: string | ReactElement;
    edition?: string;           // e.g. "2025 S1"
    tagline?: string;
  };
}
```

## Example output — `src/lib/card/themes/obsidian-gold.ts`

```ts
import type { CardTheme } from "@/lib/card/types";

export const obsidianGold: CardTheme = {
  id: "obsidian-gold",
  name: "Obsidian Gold",
  tier: "epic",
  suits: {
    spades:   { symbol: "♠", color: "#c9a84c", symbolStyle: { textShadow: "0 0 6px #c9a84c88" } },
    hearts:   { symbol: "♥", color: "#e8433a", symbolStyle: { textShadow: "0 0 6px #e8433a88" } },
    diamonds: { symbol: "♦", color: "#f0a500" },
    clubs:    { symbol: "♣", color: "#c9a84c" },
  },
  backgroundColor: "#0c0c0c",
  textColor: "#c9a84c",
  border: {
    color: "#2a2016",
    effect: "glow",
    glowColor: "#c9a84c44",
    glowSize: 6,
  },
  back: {
    color: "#0c0c0c",
    pattern:
      "repeating-conic-gradient(#c9a84c18 0deg, transparent 0deg, transparent 22.5deg, #c9a84c18 22.5deg, #c9a84c18 23deg) center / 28px 28px",
    emblem: "✦",
  },
  playAnimation: { template: "flip" },
  font: {
    family: "'Playfair Display', serif",
    rankItalic: true,
  },
  trumpColor: "#c9a84c",
};
```

## Example output — `src/lib/card/themes/fc-azur.ts` (collab)

```ts
import type { CardTheme } from "@/lib/card/types";

export const fcAzur: CardTheme = {
  id: "fc-azur",
  name: "FC Azur × Wildcard",
  tier: "legendary",
  suits: {
    spades:   { symbol: "♠", color: "#c9a84c" },
    hearts:   { symbol: "♥", color: "#e8433a" },
    diamonds: { symbol: "♦", color: "#f0a500" },
    clubs:    { symbol: "♣", color: "#c9a84c" },
  },
  backgroundColor: "#001f4d",
  textColor: "#c9a84c",
  border: {
    color: "#c9a84c",
    effect: "solid",
  },
  back: {
    color: "#001838",
    pattern:
      "repeating-conic-gradient(#c9a84c14 0deg, transparent 0deg, transparent 45deg, #c9a84c14 45deg, #c9a84c14 46deg) center / 20px 20px",
    emblem: "AZ",
  },
  font: {
    family: "'Rajdhani', sans-serif",
    rankWeight: 700,
  },
  brand: {
    name: "FC Azur",
    edition: "2025 S1",
    tagline: "Édition limitée",
  },
};
```
