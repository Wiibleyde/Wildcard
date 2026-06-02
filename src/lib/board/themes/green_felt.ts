import type { BoardTheme } from "@/lib/board/types";

export const greenFeltTheme: BoardTheme = {
  id: "green_felt",
  name: "Tapis vert",
  tier: "common",
  surface: {
    background:
      "radial-gradient(ellipse at center, #166534 0%, #14532d 60%, #0f4024 100%)",
  },
  zone: {
    background: "rgba(0,0,0,0.20)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  badge: {
    background: "rgba(0,0,0,0.30)",
    textColor: "rgba(255,255,255,0.80)",
  },
  accentColor: "#4ade80",
};
