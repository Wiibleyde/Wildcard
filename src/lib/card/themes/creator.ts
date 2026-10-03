import type { CardTheme } from "@/lib/card/types";

export const creatorTheme: CardTheme = {
    id: "creator",
    name: "Fondateur",
    tier: "ethereal",
    suits: {
        spades: { symbol: "♠", color: "#ffc23d" },
        hearts: { symbol: "♥", color: "#ff4b3b" },
        diamonds: { symbol: "♦", color: "#ff4b3b" },
        clubs: { symbol: "♣", color: "#ffc23d" },
    },
    backgroundColor: "#0b1220",
    textColor: "#ffc23d",
    border: {
        color: "#ffc23d",
        effect: "solid",
        boxShadow: "0 3px 0 #05070d",
    },
    back: {
        color: "#0b1220",
        pattern: [
            "repeating-linear-gradient(45deg, rgba(255,194,61,0.18) 0px, rgba(255,194,61,0.18) 2px, transparent 2px, transparent 16px)",
            "repeating-linear-gradient(-45deg, rgba(255,194,61,0.18) 0px, rgba(255,194,61,0.18) 2px, transparent 2px, transparent 16px)",
            "linear-gradient(#0b1220, #0b1220)",
        ].join(", "),
        effects: [
            { type: "foil", color: "#ffc23d", speed: 0.6 },
            { type: "holographic" },
        ],
    },
    effects: [{ type: "shimmer", color: "#ffc23d", speed: 0.8 }],
    playAnimation: { template: "arc" },
    font: {
        family: 'var(--disp, "Titan One", system-ui, sans-serif)',
        rankWeight: 400,
    },
    trumpColor: "#ffc23d",
};
