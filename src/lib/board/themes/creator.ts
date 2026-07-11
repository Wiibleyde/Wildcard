import type { BoardTheme } from "@/lib/board/types";

export const creatorBoardTheme: BoardTheme = {
    id: "creator",
    name: "Fondateur",
    tier: "ethereal",
    surface: {
        // Ink table with a hard-edged gold lattice — matches the Fondateur deck back
        background: [
            "repeating-linear-gradient(45deg, rgba(255,194,61,0.10) 0px, rgba(255,194,61,0.10) 2px, transparent 2px, transparent 20px)",
            "repeating-linear-gradient(-45deg, rgba(255,194,61,0.10) 0px, rgba(255,194,61,0.10) 2px, transparent 2px, transparent 20px)",
            "linear-gradient(#0b1220, #0b1220)",
        ].join(", "),
    },
    zone: {
        background: "rgba(255,194,61,0.07)",
        // Gold frame — the ethereal tier gets the premium outline
        borderColor: "#ffc23d",
        boxShadow: "inset 0 3px 0 rgba(0,0,0,0.30)",
        textColor: "#ffc23d",
    },
    badge: {
        background: "#ffc23d",
        textColor: "#0b1220",
    },
    accentColor: "#ffc23d",
};
