import type { BoardTheme } from "@/lib/board/types";

export const oceanTheme: BoardTheme = {
  id: "ocean",
  name: "Océan",
  tier: "epic",
  surface: {
    background:
      "radial-gradient(ellipse at center, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  zone: {
    background: "rgba(8,145,178,0.15)",
    borderColor: "rgba(6,182,212,0.20)",
    boxShadow: "inset 0 1px 0 rgba(6,182,212,0.10)",
  },
  badge: {
    background: "rgba(8,51,68,0.50)",
    textColor: "rgba(165,243,252,0.90)",
  },
  accentColor: "#06b6d4",
};
