import type { CardTheme } from "@/lib/card/types";

export const creatorTheme: CardTheme = {
  id: "creator",
  name: "Fondateur",
  tier: "ethereal",
  suits: {
    spades: {
      symbol: "♠",
      color: "#e8c468",
      symbolStyle: { textShadow: "0 0 10px rgba(232,196,104,0.70)" },
    },
    hearts: {
      symbol: "♥",
      color: "#f87171",
      symbolStyle: { textShadow: "0 0 10px rgba(248,113,113,0.70)" },
    },
    diamonds: {
      symbol: "♦",
      color: "#f87171",
      symbolStyle: { textShadow: "0 0 10px rgba(248,113,113,0.70)" },
    },
    clubs: {
      symbol: "♣",
      color: "#e8c468",
      symbolStyle: { textShadow: "0 0 10px rgba(232,196,104,0.70)" },
    },
  },
  backgroundColor: "#05050a",
  textColor: "#e8c468",
  border: {
    color: "#e8c468",
    effect: "glow",
    glowColor: "rgba(232,196,104,0.50)",
    glowSize: 14,
  },
  back: {
    color: "#05050a",
    // Geometric gold grid over deep obsidian
    pattern: [
      "repeating-linear-gradient(45deg, rgba(232,196,104,0.06) 0px, rgba(232,196,104,0.06) 1px, transparent 1px, transparent 18px)",
      "repeating-linear-gradient(-45deg, rgba(232,196,104,0.06) 0px, rgba(232,196,104,0.06) 1px, transparent 1px, transparent 18px)",
      "radial-gradient(ellipse at 50% 50%, #130f1f 0%, #05050a 100%)",
    ].join(", "),
    effects: [
      { type: "foil", color: "#e8c468", speed: 0.6 },
      { type: "holographic" },
    ],
  },
  effects: [{ type: "shimmer", color: "#e8c468", speed: 0.8 }],
  trumpColor: "#e8c468",
};
