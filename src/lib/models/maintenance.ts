import type { AdminClient } from "@/lib/supabase/admin";
import { endGame, settlePendingGames } from "./game/settle";

const AFK_MS = 24 * 60 * 60 * 1000;

export interface ReapSummary {
    /** No human left at the table. */
    readonly botOnly: number;
    /** Untouched for {@link AFK_MS}. */
    readonly afk: number;
    /** Distinct games reaped (a game can match both reasons). */
    readonly reaped: number;
    /** Owed settlements recorded by this pass. */
    readonly settled: number;
}

/**
 * Close (never delete: replays and history hang off them) live games that can
 * no longer resolve: bot-only tables, whose `after()` chain died with its
 * process, and tables idle for a day. Goes through {@link endGame}, so a game
 * that comes back to life mid-sweep wins the race. Idempotent; run at boot.
 */
export async function reapStaleGames(admin: AdminClient): Promise<ReapSummary> {
    const settled = await settlePendingGames(admin);
    const empty: ReapSummary = { botOnly: 0, afk: 0, reaped: 0, settled };

    const { data: games, error } = await admin
        .from("games")
        .select("id, room_id, updated_at")
        .eq("is_over", false);
    if (error) {
        console.error("[maintenance] live games read failed:", error.message);
        return empty;
    }
    if (games.length === 0) return empty;

    // Bots have no room_players row, so zero `player` rows = bot-only.
    const { data: seats, error: seatsError } = await admin
        .from("room_players")
        .select("room_id")
        .eq("role", "player")
        .in("room_id", [...new Set(games.map((g) => g.room_id))]);
    // Unknown seats would read as "bot-only" and close live games.
    if (seatsError) {
        console.error("[maintenance] seats read failed:", seatsError.message);
        return empty;
    }
    const humansByRoom = new Map<string, number>();
    for (const s of seats) {
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
