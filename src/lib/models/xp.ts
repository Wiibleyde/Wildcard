import type { GameOutcome } from "@/lib/engine/types";
import { computeXpAwards } from "@/lib/xp/xp";

/** One participant's XP grant, as `wildcard.settle_game` applies it. */
export interface XpAwardRow {
    readonly user_id: string;
    readonly amount: number;
}

export interface XpAwardOptions {
    readonly moduleId: string;
    /** Forfeiters earn nothing. */
    readonly excluded?: readonly string[];
    /** Moves actually played; an out-of-band end adds none. */
    readonly moveCount: number;
}

/**
 * Anti-farming: no XP without an outcome, a winner and at least one move —
 * otherwise "start solitaire, resign, repeat" would mint XP at request rate.
 */
export function xpAwardsForGame(
    outcome: GameOutcome | null,
    botIds: readonly string[],
    { moduleId, excluded = [], moveCount }: XpAwardOptions,
): XpAwardRow[] {
    if (!outcome || outcome.winners.length === 0 || moveCount <= 0) return [];
    return computeXpAwards({
        moduleId,
        rankings: outcome.rankings,
        winners: outcome.winners,
        botIds,
        excluded,
    }).map((a) => ({ user_id: a.playerId, amount: a.amount }));
}
