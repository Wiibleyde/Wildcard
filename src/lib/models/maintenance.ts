import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { endGame, settlePendingGames } from "./game";

type Admin = SupabaseClient<Database>;

/** A game is "AFK" once nothing has touched it for this long. */
const AFK_MS = 24 * 60 * 60 * 1000; // 1 day

export interface ReapSummary {
    /** Games marked finished because no human was left at the table. */
    readonly botOnly: number;
    /** Games marked finished because of inactivity past {@link AFK_MS}. */
    readonly afk: number;
    /** Distinct games reaped (a game can match both reasons, counted once). */
    readonly reaped: number;
    /** Finished games whose owed settlement (room, ELO/XP) this pass recorded. */
    readonly settled: number;
}

/**
 * Mark abandoned ongoing games as finished. Two kinds of dead game pile up and
 * never resolve on their own:
 *
 *   * **Bot-only / empty** — every human has left the room, so no human action
 *     will ever fire `advanceBots` again. The bots are stranded mid-turn (the
 *     bot chain is an in-process `after()` task; a server restart drops it), so
 *     the game sits at `is_over = false` forever.
 *   * **AFK** — humans are still seated but nobody has played for over a day.
 *
 * Both are *closed*, not deleted, through the same out-of-band end as an admin
 * force-end ({@link endGame}): a compare-and-set version bump (so a game that
 * comes back to life mid-sweep wins the race and stays live, and connected
 * clients refetch), `is_over = true` with no winner, room finished, settled
 * once. We keep every row (games / game_states / game_actions) so the
 * replay/audit trail survives — the same "don't erase history" rule that stops
 * `leaveRoom` from deleting a played room. No result, so no ELO is awarded.
 *
 * The pass also settles finished games whose settlement never landed
 * ({@link settlePendingGames}). Idempotent: a second pass finds nothing.
 * Runs through the service role (bypasses RLS) — see the startup hook in
 * `src/instrumentation.ts`.
 */
export async function reapStaleGames(admin: Admin): Promise<ReapSummary> {
    const settled = await settlePendingGames(admin);
    const empty: ReapSummary = { botOnly: 0, afk: 0, reaped: 0, settled };

    const { data: games, error } = await admin
        .from("games")
        .select("id, room_id, updated_at")
        .eq("is_over", false);
    if (error) {
        console.error("[maintenance] live games read failed:", error.message);
    }
    if (error || !games || games.length === 0) return empty;

    const roomIds = [...new Set(games.map((g) => g.room_id))];

    // Human seats per room — bots never get a room_players row, so a room with
    // zero `player` rows is bot-only (or fully empty after everyone left).
    const { data: seats, error: seatsError } = await admin
        .from("room_players")
        .select("room_id")
        .eq("role", "player")
        .in("room_id", roomIds);
    // Unknown seats would read as "bot-only" and close live games: bail out.
    if (seatsError) {
        console.error("[maintenance] seats read failed:", seatsError.message);
        return empty;
    }
    const humansByRoom = new Map<string, number>();
    for (const s of seats ?? []) {
        humansByRoom.set(s.room_id, (humansByRoom.get(s.room_id) ?? 0) + 1);
    }

    const cutoff = Date.now() - AFK_MS;
    let botOnly = 0;
    let afk = 0;
    let reaped = 0;

    for (const g of games) {
        const isBotOnly = (humansByRoom.get(g.room_id) ?? 0) === 0;
        const isAfk = new Date(g.updated_at).getTime() < cutoff;
        if (!isBotOnly && !isAfk) continue;

        const ended = await endGame(admin, g.id, { reason: "abandoned" });
        if (!ended.ok) {
            console.error(`[maintenance] reap of ${g.id} failed:`, ended.error);
            continue;
        }
        if (isBotOnly) botOnly++;
        if (isAfk) afk++;
        reaped++;
    }

    return { botOnly, afk, reaped, settled };
}
