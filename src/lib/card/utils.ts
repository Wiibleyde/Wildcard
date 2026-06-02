import type { Rank } from "./types";

const PIP_INDEX: Partial<Record<string, number>> = {
  A: 1,
  J: 11,
  C: 12, // Cavalier
  Q: 13,
  K: 14,
};

/**
 * Returns the numeric key used to look up pip layouts in PIP_LAYOUTS.
 * A=1, 2–10 as-is, J=11, C=12, Q=13, K=14.
 *
 * Not for game logic — ranking rules are game-specific (e.g. Ace is
 * highest in Bataille but context-dependent in Belote/Coinche).
 */
export function rankToPipIndex(rank: Rank): number {
  return PIP_INDEX[rank] ?? Number.parseInt(rank, 10);
}
