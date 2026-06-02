import type { CardTheme } from "@/lib/card/types";

export const freeTheme: CardTheme = {
  id: "free",
  name: "Classic",
  tier: "free",
  suits: {
    spades: { symbol: "♠", color: "#111827" },
    hearts: { symbol: "♥", color: "#dc2626" },
    diamonds: { symbol: "♦", color: "#dc2626" },
    clubs: { symbol: "♣", color: "#111827" },
  },
  backgroundColor: "#ffffff",
  textColor: "#111827",
  border: { color: "#d1d5db", effect: "solid" },
  back: {
    color: "#1e3a8a",
    pattern:
      "repeating-linear-gradient(45deg,#1d4ed8 0px,#1d4ed8 6px,#1e3a8a 6px,#1e3a8a 14px)",
  },
  // Warm amber for tarot trumps — evokes gold ink on traditional tarot decks
  trumpColor: "#92400e",
};
