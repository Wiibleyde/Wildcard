import type { GameOutcome } from "@/lib/engine/types";
import { computeXpAwards } from "@/lib/xp/xp";

/** One participant's XP grant, as `wildcard.settle_game` applies it. */
export interface XpAwardRow {
    readonly user_id: string;
    readonly amount: number;
}

export interface XpAwardOptions {
    /** Module id — picks the game's XP weight. */
    readonly moduleId: string;
    /** Players who forfeited by leaving — they earn nothing. */
    readonly excluded?: readonly string[];
    /**
     * Moves actually played before the end (logged actions; an out-of-band end
     * adds none). A game over at the deal, or closed before anyone moved, is
     * not a played game and earns no XP.
     */
    readonly moveCount: number;
}

/**
 * XP grants for one finished game — **server-only**, applied by
 * `wildcard.settle_game` in the same transaction that marks the game settled
 * (exactly once, see `settleGame` in ./game.ts).
 *
 * Every human participant earns XP (participation + win bonus, weighted by the
 * game — see `computeXpAwards`); bots — and any id in `excluded` (a player who
 * forfeited by leaving) — earn nothing.
 *
 * Anti-farming: a game earns XP only if it was actually played and actually
 * won. No outcome (admin / reaper end), an outcome without winners (a solo
 * resign, a void deal) or zero moves (over at the deal, forfeited before the
 * first move) grants nothing — otherwise "start solitaire, resign, repeat"
 * would mint participation XP at request rate. ELO is unaffected by this rule.
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
