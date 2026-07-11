import type { CardTheme } from "@/lib/card/types";

/**
 * Classic deck, neobrutalism edition: cream face, thick ink outline with a
 * hard offset shadow (zero blur), ink + vermilion suits, Lilita One ranks.
 * Mirrors the app-wide v2 design tokens (`--ink`, `--cream`, `--red`, `--bg`).
 */
export const freeTheme: CardTheme = {
    id: "free",
    name: "Classic",
    tier: "common",
    suits: {
        spades: { symbol: "♠", color: "#0b1220" },
        hearts: { symbol: "♥", color: "#ff4b3b" },
        diamonds: { symbol: "♦", color: "#ff4b3b" },
        clubs: { symbol: "♣", color: "#0b1220" },
    },
    backgroundColor: "#f7edd4",
    textColor: "#0b1220",
    border: {
        color: "#0b1220",
        effect: "solid",
        boxShadow: "0 3px 0 #0b1220",
    },
    back: {
        color: "#12294a",
        // Bold cobalt/blue diagonal stripes — arcade, not SaaS
        pattern:
            "repeating-linear-gradient(45deg,#3b8cff 0px,#3b8cff 7px,#12294a 7px,#12294a 16px)",
    },
    // Lilita One is single-weight (400) — rankWeight avoids faux-bold smearing
    font: {
        family: 'var(--disp, "Lilita One", system-ui, sans-serif)',
        rankWeight: 400,
    },
    // Deep amber for tarot trumps — readable on cream, gold family
    trumpColor: "#a16207",
};
