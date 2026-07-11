import type { BoardTheme } from "@/lib/board/types";

export const darkWoodTheme: BoardTheme = {
    id: "dark_wood",
    name: "Bois sombre",
    tier: "rare",
    surface: {
        // Cartoon planks: two flat browns separated by hard ink seams
        background: [
            "radial-gradient(rgba(0,0,0,0.14) 1.4px, transparent 1.5px) 0 0 / 22px 22px",
            "repeating-linear-gradient(90deg, #7a4a26 0px, #7a4a26 34px, #6b3d1e 34px, #6b3d1e 68px, #0b1220 68px, #0b1220 70.5px)",
        ].join(", "),
    },
    zone: {
        background: "rgba(11,18,32,0.38)",
        borderColor: "#0b1220",
        boxShadow: "inset 0 3px 0 rgba(0,0,0,0.25)",
        textColor: "#f7edd4",
    },
    badge: {
        background: "#ffc23d",
        textColor: "#0b1220",
    },
    accentColor: "#ffc23d",
};
