import type { CardTheme } from "@/lib/card/types";

export const freeTheme: CardTheme = {
  id: "free",
  name: "Classic",
  isPaid: false,
  suits: {
    spades: { symbol: "♠", color: "#111827" },
    hearts: { symbol: "♥", color: "#dc2626" },
    diamonds: { symbol: "♦", color: "#dc2626" },
    clubs: { symbol: "♣", color: "#111827" },
  },
  backgroundColor: "#ffffff",
  textColor: "#111827",
  border: {
    color: "#d1d5db",
    effect: "solid",
  },
  backColor: "#1e3a8a",
  backPattern:
    "repeating-linear-gradient(45deg, #1d4ed8 0px, #1d4ed8 6px, #1e3a8a 6px, #1e3a8a 14px)",
};
