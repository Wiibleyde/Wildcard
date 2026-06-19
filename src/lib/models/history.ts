import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/** One seat as it appears in a finished game's history row. */
export interface MatchPlayer {
    readonly id: string;
    readonly name: string;
    readonly isBot: boolean;
    readonly isWinner: boolean;
    /** True for the viewer this history was built for. */
    readonly isYou: boolean;
}

/** The viewer's result in a finished game. `none` = no winner recorded. */
export type MatchResult = "win" | "loss" | "none";

/** A single finished game in a player's history. */
export interface MatchHistoryEntry {
    readonly gameId: string;
    readonly moduleId: string;
    /** Display name of the game module, falling back to its id. */
    readonly moduleName: string;
    /** ISO timestamp the game was created. */
    readonly playedAt: string;
    readonly result: MatchResult;
    /** Every seat, in seating order. */
    readonly players: readonly MatchPlayer[];
}

/** Cap on how many finished games we load — most recent first. */
const HISTORY_LIMIT = 100;

/**
 * A player's match history: every finished game they sat in, newest first.
 *
 * Participation is read from the authoritative engine state, not from
 * `room_players` — that seat is deleted when a player leaves the room, so it
 * cannot reconstruct who played a past game. `game_states.state.players` is
 * stamped at deal time and never mutated, so it survives the player leaving and
 * even the room being reused. The lookup is a jsonb containment match
 * (`state @> {players:[{id}]}`); a GIN index on `state` would make it indexed,
 * but at our scale a scan over finished games is fine.
 *
 * Must run with the service-role `admin` client: `game_states` is the secret
 * full state (RLS denies every client key). We only ever read the public-safe
 * `players` projection out of it here — never hand raw state to a client.
 */
export async function getMatchHistory(
    admin: Admin,
    userId: string,
): Promise<MatchHistoryEntry[]> {
    // 1. Games whose seated players include the viewer (durable participation).
    const { data: states } = await admin
        .from("game_states")
        .select("game_id, players:state->players")
        .contains("state", { players: [{ id: userId }] });
    if (!states || states.length === 0) return [];

    const playersByGame = new Map<string, Player[]>();
    for (const row of states) {
        playersByGame.set(
            row.game_id,
            (row.players ?? []) as unknown as Player[],
        );
    }

    // 2. Public meta for those games — only the finished ones, newest first.
    const { data: metas } = await admin
        .from("games")
        .select("id, module_id, winner_ids, bot_ids, created_at")
        .in("id", [...playersByGame.keys()])
        .eq("is_over", true)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
    if (!metas || metas.length === 0) return [];

    return metas.map((meta) => {
        const winners = new Set(meta.winner_ids);
        const bots = new Set(meta.bot_ids);
        const seats = [...(playersByGame.get(meta.id) ?? [])].sort(
            (a, b) => a.seat - b.seat,
        );

        const won = winners.has(userId);
        const result: MatchResult = won
            ? "win"
            : winners.size > 0
              ? "loss"
              : "none";

        return {
            gameId: meta.id,
            moduleId: meta.module_id,
            moduleName: getGameModule(meta.module_id)?.name ?? meta.module_id,
            playedAt: meta.created_at,
            result,
            players: seats.map((p) => ({
                id: p.id,
                name: p.name,
                isBot: bots.has(p.id),
                isWinner: winners.has(p.id),
                isYou: p.id === userId,
            })),
        };
    });
}
