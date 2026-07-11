import type { BoardTheme } from "@/lib/board/types";

export const midnightTheme: BoardTheme = {
    id: "midnight",
    name: "Minuit",
    tier: "legendary",
    surface: {
        background: [
            "radial-gradient(rgba(155,108,242,0.10) 1.4px, transparent 1.5px) 0 0 / 22px 22px",
            "radial-gradient(rgba(0,0,0,0.20) 1.4px, transparent 1.5px) 11px 11px / 22px 22px",
            "linear-gradient(#101f35, #101f35)",
        ].join(", "),
    },
    zone: {
        background: "rgba(5,10,20,0.55)",
        // Purple frame — an ink outline would vanish on the near-ink surface
        borderColor: "#9b6cf2",
        boxShadow: "inset 0 3px 0 rgba(0,0,0,0.30)",
        textColor: "#f7edd4",
    },
    badge: {
        background: "#9b6cf2",
        textColor: "#0b1220",
    },
    accentColor: "#9b6cf2",
};
