import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";
import { type GameRuleToggle, resolveRuleToggles } from "@/lib/engine/types";
import {
    type Role,
    type SeatRow,
    type SpectatorRow,
    splitRoster,
} from "@/lib/lobby/roster";
import { nameTag, usernamesByIds } from "@/lib/models/identities";
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
    isMember: boolean;
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
    isMember,
}: Params) {
    const router = useRouter();
    const tCommon = useTranslations("common");
    const fallbackName = useCallback(
        (id: string) => tCommon("player_fallback", { tag: nameTag(id) }),
        [tCommon],
    );
    const [seats, setSeats] = useState<SeatRow[]>(initialSeats);
    const [spectators, setSpectators] =
        useState<SpectatorRow[]>(initialSpectators);
    const [role, setRole] = useState<Role>(initialRole);
    const [hostId, setHostId] = useState(initialHostId);
    const [botCount, setBotCount] = useState(initialBotCount);
    const [rules, setRules] = useState<Record<string, boolean>>(() =>
        resolveRuleToggles(ruleToggles, initialRules),
    );

    const joinedRef = useRef(isMember);
    // Once left or unmounted, late refreshes must not update state nor navigate.
    const closedRef = useRef(false);
    useEffect(() => {
        closedRef.current = false;
        return () => {
            closedRef.current = true;
        };
    }, []);

    // Poll, doorbell and post-mutation refreshes can resolve out of order: only the latest commits.
    const seqRef = useRef(0);
    // >0 while a host mutation is in flight: a refresh landing mid-POST would
    // read the pre-mutation row and stomp the optimistic bots/rules.
    const mutatingRef = useRef(0);

    const refresh = useCallback(async () => {
        const seq = ++seqRef.current;
        const isStale = () => closedRef.current || seq !== seqRef.current;
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
        // A failed read (null) must not wipe the seat list or demote us.
        if (isStale() || players === null) return;

        if (room?.status === "playing" && room.current_game_id) {
            router.push(`/game/${room.current_game_id}`);
            return;
        }
        if (room?.host_id) setHostId(room.host_id);
        if (mutatingRef.current === 0) {
            if (typeof room?.bot_count === "number") {
                setBotCount(room.bot_count);
            }
            if (room?.rules) {
                setRules(resolveRuleToggles(ruleToggles, room.rules));
            }
        }

        const nameOf = await usernamesByIds(
            supabase,
            players.map((r) => r.user_id),
        ).catch(() => new Map<string, string>());
        if (isStale()) return;
        const roster = splitRoster(players, nameOf, fallbackName);
        setSeats(roster.seats);
        setSpectators(roster.spectators);
        const mine = players.find((r) => r.user_id === currentUserId);
        setRole(mine?.role === "player" ? "player" : "spectator");
    }, [roomId, router, currentUserId, ruleToggles, fallbackName]);

    useEffect(() => {
        async function bootstrap() {
            if (!joinedRef.current) {
                joinedRef.current = true;
                // The join may seat us as a spectator or fail: the refresh reads
                // the role the server actually recorded.
                await apiFetch(`/api/rooms/${code}/join`, {
                    method: "POST",
                }).catch(() => null);
            }
            await refresh();
        }
        bootstrap().catch(() => {});
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
        mutatingRef,
    };
}
