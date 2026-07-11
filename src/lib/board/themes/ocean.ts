import type { BoardTheme } from "@/lib/board/types";

export const oceanTheme: BoardTheme = {
    id: "ocean",
    name: "Océan",
    tier: "epic",
    surface: {
        background: [
            "radial-gradient(rgba(255,255,255,0.06) 1.4px, transparent 1.5px) 0 0 / 22px 22px",
            "radial-gradient(rgba(0,0,0,0.14) 1.4px, transparent 1.5px) 11px 11px / 22px 22px",
            "linear-gradient(#0f5b8f, #0f5b8f)",
        ].join(", "),
    },
    zone: {
        background: "rgba(6,32,56,0.50)",
        borderColor: "#0b1220",
        boxShadow: "inset 0 3px 0 rgba(0,0,0,0.22)",
        textColor: "#f7edd4",
    },
    badge: {
        background: "#3b8cff",
        textColor: "#fff7ee",
    },
    accentColor: "#3b8cff",
};
