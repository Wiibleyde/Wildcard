import { useCallback, useEffect, useRef, useState } from "react";
import type {
    Role,
    SeatRow,
    SpectatorRow,
} from "@/components/lobby/room/types";
import { useRouter } from "@/i18n/navigation";
import { type GameRuleToggle, resolveRuleToggles } from "@/lib/engine/types";
import { usernamesByIds } from "@/lib/models/usernames";
import { useRoomChannel } from "@/lib/realtime/useRoomChannel";
import { createClient } from "@/lib/supabase/client";

type Params = {
    roomId: string;
    code: string;
    currentUserId: string;
    ruleToggles: readonly GameRuleToggle[];
    initialSeats: SeatRow[];
    initialSpectators: SpectatorRow[];
    initialHostId: string;
    initialBotCount: number;
    initialRole: Role;
    initialRules: Record<string, boolean>;
    seated: boolean;
};

export function useRoomRefresh({
    roomId,
    code,
    currentUserId,
    ruleToggles,
    initialSeats,
    initialSpectators,
    initialHostId,
    initialBotCount,
    initialRole,
    initialRules,
    seated,
}: Params) {
    const router = useRouter();
    const [seats, setSeats] = useState<SeatRow[]>(initialSeats);
    const [spectators, setSpectators] =
        useState<SpectatorRow[]>(initialSpectators);
    const [role, setRole] = useState<Role>(initialRole);
    const [hostId, setHostId] = useState(initialHostId);
    const [botCount, setBotCount] = useState(initialBotCount);
    const [rules, setRules] = useState<Record<string, boolean>>(() =>
        resolveRuleToggles(ruleToggles, initialRules),
    );

    const joinedRef = useRef(seated);
    // Once the user left (or the component unmounted), late refreshes must
    // neither update state nor yank them back into the game page.
    const closedRef = useRef(false);
    useEffect(() => {
        closedRef.current = false;
        return () => {
            closedRef.current = true;
        };
    }, []);

    const refresh = useCallback(async () => {
        const supabase = createClient();
        const [{ data: room }, { data: players }] = await Promise.all([
            supabase
                .from("rooms")
                .select("status, current_game_id, host_id, bot_count, rules")
                .eq("id", roomId)
                .maybeSingle(),
            supabase
                .from("room_players")
                .select("user_id, seat, role")
                .eq("room_id", roomId)
                .order("seat", { ascending: true }),
        ]);
        if (closedRef.current) return;

        if (room?.status === "playing" && room.current_game_id) {
            router.push(`/game/${room.current_game_id}`);
            return;
        }
        if (room?.host_id) setHostId(room.host_id);
        if (typeof room?.bot_count === "number") setBotCount(room.bot_count);
        if (room?.rules) {
            setRules(resolveRuleToggles(ruleToggles, room.rules));
        }

        const rows = players ?? [];
        const nameOf = await usernamesByIds(
            supabase,
            rows.map((r) => r.user_id),
        );
        if (closedRef.current) return;
        setSeats(
            rows
                .filter((r) => r.role === "player" && r.seat !== null)
                .map((r) => ({
                    userId: r.user_id,
                    seat: r.seat as number,
                    username: nameOf.get(r.user_id) ?? "Joueur",
                })),
        );
        setSpectators(
            rows
                .filter((r) => r.role === "spectator")
                .map((r) => ({
                    userId: r.user_id,
                    username: nameOf.get(r.user_id) ?? "Joueur",
                })),
        );
        const mine = rows.find((r) => r.user_id === currentUserId);
        setRole(mine?.role === "spectator" ? "spectator" : "player");
    }, [roomId, router, currentUserId, ruleToggles]);

    useEffect(() => {
        async function bootstrap() {
            if (!joinedRef.current) {
                joinedRef.current = true;
                await fetch(`/api/rooms/${code}/join`, { method: "POST" });
            }
            await refresh();
        }
        bootstrap();
    }, [code, refresh]);

    const conn = useRoomChannel(roomId, refresh);

    return {
        seats,
        spectators,
        role,
        setRole,
        hostId,
        botCount,
        setBotCount,
        rules,
        setRules,
        conn,
        refresh,
        closedRef,
    };
}
