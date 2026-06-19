import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

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
 * Both are *closed*, not deleted: `is_over = true` + `status = 'finished'` with
 * no winner. We keep every row (games / game_states / game_actions) so the
 * replay/audit trail survives — the same "don't erase history" rule that stops
 * {@link leaveRoom} from deleting a played room. No `outcome()` ran, so no ELO
 * was ever awarded; the closed game simply stops being "ongoing".
 *
 * Reads only public-safe tables (games / room_players). Idempotent: a second
 * pass finds nothing because reaped games no longer have `is_over = false`.
 * Runs through the service role (bypasses RLS) — see the startup hook in
 * `src/instrumentation.ts`.
 */
export async function reapStaleGames(admin: Admin): Promise<ReapSummary> {
    const empty: ReapSummary = { botOnly: 0, afk: 0, reaped: 0 };

    const { data: games, error } = await admin
        .from("games")
        .select("id, room_id, updated_at")
        .eq("is_over", false);
    if (error || !games || games.length === 0) return empty;

    const roomIds = [...new Set(games.map((g) => g.room_id))];

    // Human seats per room — bots never get a room_players row, so a room with
    // zero `player` rows is bot-only (or fully empty after everyone left).
    const { data: seats } = await admin
        .from("room_players")
        .select("room_id")
        .eq("role", "player")
        .in("room_id", roomIds);
    const humansByRoom = new Map<string, number>();
    for (const s of seats ?? []) {
        humansByRoom.set(s.room_id, (humansByRoom.get(s.room_id) ?? 0) + 1);
    }

    const cutoff = Date.now() - AFK_MS;
    const staleGameIds: string[] = [];
    const staleRoomIds = new Set<string>();
    let botOnly = 0;
    let afk = 0;

    for (const g of games) {
        const isBotOnly = (humansByRoom.get(g.room_id) ?? 0) === 0;
        const isAfk = new Date(g.updated_at).getTime() < cutoff;
        if (!isBotOnly && !isAfk) continue;
        if (isBotOnly) botOnly++;
        if (isAfk) afk++;
        staleGameIds.push(g.id);
        staleRoomIds.add(g.room_id);
    }

    if (staleGameIds.length === 0) return empty;

    const now = new Date().toISOString();
    // Close the games first: even if the room update below fails, the game is
    // already out of every "ongoing games" query.
    await admin
        .from("games")
        .update({ is_over: true, updated_at: now })
        .in("id", staleGameIds);
    await admin
        .from("rooms")
        .update({ status: "finished" })
        .in("id", [...staleRoomIds]);

    return { botOnly, afk, reaped: staleGameIds.length };
}
