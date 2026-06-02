import type { Rank } from "./types";

const RANK_TO_NUMBER: Partial<Record<string, number>> = {
  A: 1,
  J: 11,
  C: 12, // Cavalier
  Q: 13,
  K: 14,
};

export function rankToNumber(rank: Rank): number {
  return RANK_TO_NUMBER[rank] ?? Number.parseInt(rank, 10);
}
