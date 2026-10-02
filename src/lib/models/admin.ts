import { getGameModule } from "@/lib/games";
import { ecaNamesByModuleIds } from "@/lib/games/resolve";
import type { AdminClient } from "@/lib/supabase/admin";
import { usernamesByIds } from "./identities";

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
    /** Bots have no portal identity to name. */
    currentIsBot: boolean;
    startedAt: string;
};

const ONGOING_LIMIT = 50;

/**
 * Live games for the moderator dashboard. Service-role, because members-only
 * room policies would hide stuck private games; the caller must have checked
 * the moderator role. Never reads `game_states`.
 */
export async function listOngoingGames(
    admin: AdminClient,
): Promise<OngoingGame[]> {
    const { data: rows, error } = await admin
        .from("games")
        .select(
            "id, room_id, module_id, phase, current_player_id, bot_ids, created_at",
        )
        .eq("is_over", false)
        .order("created_at", { ascending: false })
        .limit(ONGOING_LIMIT);
    if (error) throw new Error(`listOngoingGames failed: ${error.message}`);
    if (rows.length === 0) return [];

    const roomIds = [...new Set(rows.map((g) => g.room_id))];
    const [rooms, seats] = await Promise.all([
        admin.from("rooms").select("id, code").in("id", roomIds),
        admin
            .from("room_players")
            .select("room_id, user_id")
            .eq("role", "player")
            .in("room_id", roomIds),
    ]);
    if (rooms.error) throw new Error(rooms.error.message);
    if (seats.error) throw new Error(seats.error.message);

    const codeByRoom = new Map(rooms.data.map((r) => [r.id, r.code]));
    const playersByRoom = new Map<string, number>();
    for (const s of seats.data) {
        playersByRoom.set(s.room_id, (playersByRoom.get(s.room_id) ?? 0) + 1);
    }

    const isBotTurn = (g: (typeof rows)[number]): boolean =>
        g.current_player_id !== null && g.bot_ids.includes(g.current_player_id);
    const [nameOf, ecaNames] = await Promise.all([
        usernamesByIds(
            admin,
            rows
                .filter((g) => !isBotTurn(g))
                .map((g) => g.current_player_id)
                .filter((id): id is string => id !== null),
        ),
        ecaNamesByModuleIds(
            admin,
            rows.map((g) => g.module_id),
        ),
    ]);

    return rows.map((g) => ({
        gameId: g.id,
        roomId: g.room_id,
        roomCode: codeByRoom.get(g.room_id) ?? "—",
        moduleId: g.module_id,
        moduleName:
            getGameModule(g.module_id)?.name ??
            ecaNames.get(g.module_id) ??
            g.module_id,
        phase: g.phase,
        playerCount: playersByRoom.get(g.room_id) ?? 0,
        botCount: g.bot_ids.length,
        currentPlayerName:
            g.current_player_id && !isBotTurn(g)
                ? (nameOf.get(g.current_player_id) ?? null)
                : null,
        currentIsBot: isBotTurn(g),
        startedAt: g.created_at,
    }));
}
