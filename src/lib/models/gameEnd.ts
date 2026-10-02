import type { GameOutcome } from "@/lib/engine/types";
import type { GameEndReason } from "@/lib/supabase/types";
import { xpAwardsForGame } from "./xp";

export type { GameEndReason };

/**
 * How a finished game ended, as shipped to the client next to the outcome.
 * Pure data, derived from the persisted `games` row (`end_reason`,
 * `forfeited_by`, `winner_ids`) — an out-of-band end (forfeit / admin /
 * reaper) never touches the secret state, so `module.outcome(state)` alone
 * cannot describe it.
 */
export interface GameEndInfo {
    /** `null` = ended by legacy code before `end_reason` existed. */
    readonly reason: GameEndReason | null;
    /** Who walked out (reason `forfeit`). */
    readonly forfeitedBy: string | null;
    /**
     * XP the settlement granted the viewer (same rule as `settleGame`); `null`
     * for a spectator. 0 = participated but earned nothing.
     */
    readonly xpGained: number | null;
}

/**
 * Rebuild standings from the stored `winner_ids` when the state never reached
 * a terminal position (forfeit): winners share rank 1, everyone else shares
 * the next rank, the forfeiter last — competition ranking, so in a 3-seat
 * game with two winners the forfeiter is rank 3 (last), not 2.
 */
export function outcomeFromWinners(
    playerIds: readonly string[],
    winnerIds: readonly string[],
    forfeitedBy: string | null,
): GameOutcome | null {
    if (winnerIds.length === 0) return null;
    const winners = new Set(winnerIds);
    const others = playerIds.filter(
        (id) => !winners.has(id) && id !== forfeitedBy,
    );
    const seatedWinners = playerIds.filter((id) => winners.has(id));
    const rankings: { playerId: string; rank: number }[] = [
        ...seatedWinners.map((playerId) => ({ playerId, rank: 1 })),
        ...others.map((playerId) => ({
            playerId,
            rank: seatedWinners.length + 1,
        })),
    ];
    if (forfeitedBy !== null && playerIds.includes(forfeitedBy)) {
        rankings.push({
            playerId: forfeitedBy,
            rank: seatedWinners.length + others.length + 1,
        });
    }
    return {
        rankings,
        winners: seatedWinners,
    };
}

export interface EndFacts {
    /** `games.end_reason` (null on a legacy row). */
    readonly reason: GameEndReason | null;
    /** `module.isOver(state)` — the recorded state is a finished position. */
    readonly terminal: boolean;
    /** `module.outcome(state)` (only meaningful when `terminal`). */
    readonly stateOutcome: GameOutcome | null;
    readonly playerIds: readonly string[];
    readonly winnerIds: readonly string[];
    readonly forfeitedBy: string | null;
}

/**
 * The outcome a finished game is settled and displayed with:
 *   - the module's own outcome when the state is terminal (natural end);
 *   - none for an admin force-end or a reaper close;
 *   - otherwise (forfeit, or a legacy out-of-band end) the standings rebuilt
 *     from the stored winners.
 */
export function resolveEndOutcome(facts: EndFacts): GameOutcome | null {
    if (facts.terminal) return facts.stateOutcome;
    if (facts.reason === "admin" || facts.reason === "abandoned") return null;
    return outcomeFromWinners(
        facts.playerIds,
        facts.winnerIds,
        facts.forfeitedBy,
    );
}

/**
 * Moves actually played. Every logged action bumps `version` by one; an
 * out-of-band end (forfeit / admin / reaper) bumps it once more without a move.
 */
export function playedMoves(version: number, terminal: boolean): number {
    return terminal ? version : Math.max(0, version - 1);
}

/** The viewer-facing {@link GameEndInfo} for a finished game. */
export function describeEnd(
    facts: EndFacts & {
        readonly moduleId: string;
        readonly outcome: GameOutcome | null;
        readonly botIds: readonly string[];
        readonly version: number;
        readonly viewerId: string | null;
    },
): GameEndInfo {
    const reason = facts.reason ?? (facts.terminal ? "natural" : null);
    let xpGained: number | null = null;
    if (facts.viewerId !== null && facts.playerIds.includes(facts.viewerId)) {
        const awards = xpAwardsForGame(facts.outcome, facts.botIds, {
            moduleId: facts.moduleId,
            excluded: facts.forfeitedBy ? [facts.forfeitedBy] : [],
            moveCount: playedMoves(facts.version, facts.terminal),
        });
        xpGained =
            awards.find((a) => a.user_id === facts.viewerId)?.amount ?? 0;
    }
    return { reason, forfeitedBy: facts.forfeitedBy, xpGained };
}
