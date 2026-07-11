import type { BoardTheme } from "@/lib/board/types";

export const greenFeltTheme: BoardTheme = {
    id: "green_felt",
    name: "Tapis vert",
    tier: "common",
    surface: {
        // Flat felt + the app's tactile dot grid — no radial vignette slop
        background: [
            "radial-gradient(rgba(255,255,255,0.05) 1.4px, transparent 1.5px) 0 0 / 22px 22px",
            "radial-gradient(rgba(0,0,0,0.16) 1.4px, transparent 1.5px) 11px 11px / 22px 22px",
            "linear-gradient(#10684b, #10684b)",
        ].join(", "),
    },
    zone: {
        background: "rgba(8,64,46,0.60)",
        borderColor: "#0b1220",
        boxShadow: "inset 0 3px 0 rgba(0,0,0,0.22)",
        textColor: "#f7edd4",
    },
    badge: {
        background: "#f7edd4",
        textColor: "#0b1220",
    },
    accentColor: "#ffc23d",
};
