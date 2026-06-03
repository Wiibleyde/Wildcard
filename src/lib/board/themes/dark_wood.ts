import type { BoardTheme } from "@/lib/board/types";

export const darkWoodTheme: BoardTheme = {
    id: "dark_wood",
    name: "Bois sombre",
    tier: "rare",
    surface: {
        background:
            "repeating-linear-gradient(90deg,#292524 0px,#292524 4px,#1c1917 4px,#1c1917 20px)",
        overlay: "rgba(0,0,0,0.15)",
    },
    zone: {
        background: "rgba(120,53,15,0.20)",
        borderColor: "rgba(217,119,6,0.15)",
        boxShadow: "inset 0 1px 0 rgba(217,119,6,0.08)",
    },
    badge: {
        background: "rgba(120,53,15,0.40)",
        textColor: "rgba(253,230,138,0.85)",
    },
    accentColor: "#d97706",
};
