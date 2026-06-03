import type { BoardTheme } from "@/lib/board/types";

export const midnightTheme: BoardTheme = {
    id: "midnight",
    name: "Minuit",
    tier: "legendary",
    surface: {
        background:
            "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0f23 60%, #000000 100%)",
    },
    zone: {
        background: "rgba(49,46,129,0.20)",
        borderColor: "rgba(129,140,248,0.15)",
        boxShadow: "inset 0 1px 0 rgba(129,140,248,0.08)",
    },
    badge: {
        background: "rgba(30,27,75,0.60)",
        textColor: "rgba(199,210,254,0.90)",
    },
    accentColor: "#818cf8",
};
