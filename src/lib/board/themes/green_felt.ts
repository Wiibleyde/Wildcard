import type { BoardTheme } from "@/lib/board/types";

export const greenFeltTheme: BoardTheme = {
    id: "green_felt",
    name: "Tapis vert",
    tier: "common",
    surface: {
        background: [
            "repeating-conic-gradient(rgba(0,0,0,0.06) 0 25%, transparent 0 50%) 0 0 / 4px 4px",
            "radial-gradient(ellipse at 50% 40%, #2c6a55 0 55%, #18402f 100%)",
        ].join(", "),
    },
    zone: {
        background: "rgba(0,0,0,0.16)",
        borderColor: "rgba(255,255,255,0.14)",
        boxShadow: "inset 0 3px 0 rgba(0,0,0,0.18)",
        textColor: "#fbf8ff",
    },
    badge: {
        background: "#2a2236",
        textColor: "#fbf8ff",
    },
    accentColor: "#f5c64f",
};
