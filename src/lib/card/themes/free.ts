import type { CardTheme } from "@/lib/card/types";

export const freeTheme: CardTheme = {
    id: "free",
    name: "Classic",
    tier: "common",
    suits: {
        spades: { symbol: "♠", color: "#241c33" },
        hearts: { symbol: "♥", color: "#f4504a" },
        diamonds: { symbol: "♦", color: "#f4504a" },
        clubs: { symbol: "♣", color: "#241c33" },
    },
    backgroundColor: "#fbf8ff",
    textColor: "#241c33",
    border: {
        color: "#d6cde6",
        width: 2,
        effect: "solid",
        boxShadow: "0 3px 0 rgba(0, 0, 0, 0.35)",
    },
    back: {
        // Red back with diagonal stripes and a centre medallion.
        color: "#f4504a",
        pattern: [
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.24) 0 13%, transparent 14%)",
            "repeating-linear-gradient(45deg, rgba(0,0,0,0.13) 0 3px, transparent 3px 9px)",
            "#f4504a",
        ].join(", "),
    },
    // Titan One is single-weight: a heavier rankWeight would faux-bold it.
    font: {
        family: 'var(--disp, "Titan One", system-ui, sans-serif)',
        rankWeight: 400,
    },
    trumpColor: "#a8811f",
};
