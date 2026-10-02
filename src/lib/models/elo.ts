import { computeEloUpdates, DEFAULT_ELO } from "@/lib/elo/elo";
import type { GameOutcome } from "@/lib/engine/types";
import type { AdminClient } from "@/lib/supabase/admin";

/** One participant's rating change, as `wildcard.settle_game` applies it. */
export interface EloResultRow {
    readonly user_id: string;
    readonly delta: number;
    readonly won: boolean;
}

/**
 * Per-module ELO changes of one finished game. Only humans are rated and at
 * least two must remain, so ELO cannot be farmed against bots. A failed
 * ratings read is an error, not "no change": settling without the deltas
 * would lose them for good, while a failed settlement is retried later.
 */
export async function eloResultsForGame(
    admin: AdminClient,
    moduleId: string,
    outcome: GameOutcome | null,
    botIds: readonly string[],
): Promise<{ ok: true; rows: EloResultRow[] } | { ok: false }> {
    if (!outcome) return { ok: true, rows: [] };

    const botSet = new Set(botIds);
    const humans = outcome.rankings.filter((r) => !botSet.has(r.playerId));
    if (humans.length < 2) return { ok: true, rows: [] };

    const { data, error } = await admin
        .from("player_elo")
        .select("user_id, rating")
        .eq("module_id", moduleId)
        .in(
            "user_id",
            humans.map((h) => h.playerId),
        );
    if (error) {
        console.error(
            `[elo] ratings read failed (${moduleId}):`,
            error.message,
        );
        return { ok: false };
    }

    // settle_game inserts a missing row at DEFAULT_ELO, the base assumed here.
    const ratingOf = new Map(data.map((row) => [row.user_id, row.rating]));
    const winners = new Set(outcome.winners);
    const rows = computeEloUpdates(
        humans.map((h) => ({
            playerId: h.playerId,
            rank: h.rank,
            rating: ratingOf.get(h.playerId) ?? DEFAULT_ELO,
        })),
    ).map((u) => ({
        user_id: u.playerId,
        delta: u.delta,
        won: winners.has(u.playerId),
    }));
    return { ok: true, rows };
}
