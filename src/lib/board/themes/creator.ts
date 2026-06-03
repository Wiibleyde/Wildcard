import type { BoardTheme } from "@/lib/board/types";

export const creatorBoardTheme: BoardTheme = {
    id: "creator",
    name: "Fondateur",
    tier: "ethereal",
    surface: {
        // Deep obsidian with gold and violet aurora halos
        background: [
            "radial-gradient(ellipse at 25% 25%, rgba(232,196,104,0.10) 0%, transparent 55%)",
            "radial-gradient(ellipse at 75% 75%, rgba(139,92,246,0.08) 0%, transparent 55%)",
            "radial-gradient(ellipse at 60% 10%, rgba(248,113,113,0.05) 0%, transparent 40%)",
            "linear-gradient(160deg, #07060f 0%, #0d0b18 45%, #07060f 100%)",
        ].join(", "),
    },
    zone: {
        background: "rgba(232,196,104,0.06)",
        borderColor: "rgba(232,196,104,0.25)",
        boxShadow:
            "inset 0 1px 0 rgba(232,196,104,0.12), 0 0 16px rgba(232,196,104,0.06)",
    },
    badge: {
        background: "rgba(15,12,30,0.70)",
        textColor: "#e8c468",
    },
    accentColor: "#e8c468",
};
