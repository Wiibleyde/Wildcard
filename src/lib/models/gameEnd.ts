import type { GameOutcome } from "@/lib/engine/types";
import type { GameEndReason } from "@/lib/supabase/types";
import { xpAwardsForGame } from "./xp";

export type { GameEndReason };

/**
 * How a finished game ended, from the persisted row: an out-of-band end never
 * touches the state, so `module.outcome(state)` cannot describe it.
 */
export interface GameEndInfo {
    /** `null` = legacy row ended before `end_reason` existed. */
    readonly reason: GameEndReason | null;
    readonly forfeitedBy: string | null;
    /** XP the settlement granted the viewer; `null` for a spectator. */
    readonly xpGained: number | null;
}

/**
 * Standings from stored winners (forfeit): winners share rank 1, the others
 * the next rank, the forfeiter last (competition ranking).
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
    return { rankings, winners: seatedWinners };
}

export interface EndFacts {
    readonly reason: GameEndReason | null;
    /** `module.isOver(state)`. */
    readonly terminal: boolean;
    readonly stateOutcome: GameOutcome | null;
    readonly playerIds: readonly string[];
    readonly winnerIds: readonly string[];
    readonly forfeitedBy: string | null;
}

/** Module outcome for a natural end, none for admin/reaper, else rebuilt from winners. */
export function resolveEndOutcome(facts: EndFacts): GameOutcome | null {
    if (facts.terminal) return facts.stateOutcome;
    if (facts.reason === "admin" || facts.reason === "abandoned") return null;
    return outcomeFromWinners(
        facts.playerIds,
        facts.winnerIds,
        facts.forfeitedBy,
    );
}

/** Each logged action bumps `version`; an out-of-band end bumps it once more. */
export function playedMoves(version: number, terminal: boolean): number {
    return terminal ? version : Math.max(0, version - 1);
}

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
