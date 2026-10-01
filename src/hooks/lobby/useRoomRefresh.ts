import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
    Role,
    SeatRow,
    SpectatorRow,
} from "@/components/lobby/room/types";
import { useRouter } from "@/i18n/navigation";
import { type GameRuleToggle, resolveRuleToggles } from "@/lib/engine/types";
import { usernamesByIds } from "@/lib/models/identities";
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
    const t = useTranslations("room");
    const fallbackName = t("unknown_player");
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

    // Overlapping refreshes (3s poll + realtime doorbell + post-mutation
    // reconcile) can resolve out of order: only the latest one may commit.
    const seqRef = useRef(0);
    // >0 while a host mutation (bots / rules) is in flight: a refresh landing
    // mid-POST would read the pre-mutation row and stomp the optimistic value,
    // so those fields are left alone until the mutation reconciles itself.
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

        const rows = players;
        const nameOf = await usernamesByIds(
            supabase,
            rows.map((r) => r.user_id),
        ).catch(() => new Map<string, string>());
        if (isStale()) return;
        setSeats(
            rows
                .filter((r) => r.role === "player" && r.seat !== null)
                .map((r) => ({
                    userId: r.user_id,
                    seat: r.seat as number,
                    username: nameOf.get(r.user_id) ?? fallbackName,
                })),
        );
        setSpectators(
            rows
                .filter((r) => r.role === "spectator")
                .map((r) => ({
                    userId: r.user_id,
                    username: nameOf.get(r.user_id) ?? fallbackName,
                })),
        );
        const mine = rows.find((r) => r.user_id === currentUserId);
        // Not (or no longer) a member → never offer player-only controls.
        setRole(mine?.role === "player" ? "player" : "spectator");
    }, [roomId, router, currentUserId, ruleToggles, fallbackName]);

    useEffect(() => {
        async function bootstrap() {
            if (!joinedRef.current) {
                joinedRef.current = true;
                // The join may seat us as a spectator (full table) or fail
                // (started / gone): the refresh below reads the role the server
                // actually recorded instead of assuming "player".
                await fetch(`/api/rooms/${code}/join`, {
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
