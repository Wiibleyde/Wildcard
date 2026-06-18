import type { SupabaseClient } from "@supabase/supabase-js";
import { GAMES } from "@/lib/games";
import type { Database } from "@/lib/supabase/types";
import { usernamesByIds } from "./usernames";

export type OngoingGame = {
    gameId: string;
    roomId: string;
    roomCode: string;
    moduleId: string;
    moduleName: string;
    phase: string;
    playerCount: number;
    botCount: number;
    currentPlayerName: string | null;
    startedAt: string;
};

/**
 * Every live game (`is_over = false`) for the moderator dashboard, newest
 * first. Reads only public-safe tables (games / rooms / room_players /
 * profiles) — never `game_states` — so the moderator sees *that* a game is
 * running and who is in it, but no private hand. Runs on the caller's
 * RLS-scoped client; access is gated at the page/route level by role.
 */
export async function listOngoingGames(
    client: SupabaseClient<Database>,
): Promise<OngoingGame[]> {
    const { data: games } = await client
        .from("games")
        .select(
            "id, room_id, module_id, phase, current_player_id, bot_ids, created_at",
        )
        .eq("is_over", false)
        .order("created_at", { ascending: false })
        .limit(50);
    const rows = games ?? [];
    if (rows.length === 0) return [];

    const roomIds = [...new Set(rows.map((g) => g.room_id))];

    const [{ data: rooms }, { data: seats }] = await Promise.all([
        client.from("rooms").select("id, code").in("id", roomIds),
        client
            .from("room_players")
            .select("room_id, user_id")
            .eq("role", "player")
            .in("room_id", roomIds),
    ]);

    const codeByRoom = new Map((rooms ?? []).map((r) => [r.id, r.code]));
    const playersByRoom = new Map<string, number>();
    for (const s of seats ?? []) {
        playersByRoom.set(s.room_id, (playersByRoom.get(s.room_id) ?? 0) + 1);
    }

    const currentIds = rows
        .map((g) => g.current_player_id)
        .filter((id): id is string => id !== null);
    const nameOf = await usernamesByIds(client, currentIds);

    return rows.map((g) => {
        const module = GAMES[g.module_id];
        return {
            gameId: g.id,
            roomId: g.room_id,
            roomCode: codeByRoom.get(g.room_id) ?? "—",
            moduleId: g.module_id,
            moduleName: module?.name ?? g.module_id,
            phase: g.phase,
            playerCount: playersByRoom.get(g.room_id) ?? 0,
            botCount: g.bot_ids?.length ?? 0,
            currentPlayerName: g.current_player_id
                ? (nameOf.get(g.current_player_id) ?? null)
                : null,
            startedAt: g.created_at,
        };
    });
}
