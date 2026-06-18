"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { useRouter } from "@/i18n/navigation";
import { usernamesByIds } from "@/lib/models/usernames";
import { useRoomChannel } from "@/lib/realtime/useRoomChannel";
import { createClient } from "@/lib/supabase/client";

export interface SeatRow {
    userId: string;
    username: string;
    seat: number;
}

export interface SpectatorRow {
    userId: string;
    username: string;
}

type Role = "player" | "spectator";

interface Props {
    roomId: string;
    code: string;
    moduleName: string;
    minPlayers: number;
    maxPlayers: number;
    currentUserId: string;
    initialSeats: SeatRow[];
    initialSpectators: SpectatorRow[];
    initialHostId: string;
    initialBotCount: number;
    seated: boolean;
    initialRole: Role;
}

type Slot =
    | { kind: "human"; username: string; userId: string }
    | { kind: "bot"; label: string }
    | null;

export function RoomClient({
    roomId,
    code,
    moduleName,
    minPlayers,
    maxPlayers,
    currentUserId,
    initialSeats,
    initialSpectators,
    initialHostId,
    initialBotCount,
    seated,
    initialRole,
}: Props) {
    const t = useTranslations("room");
    const router = useRouter();
    const [seats, setSeats] = useState<SeatRow[]>(initialSeats);
    const [spectators, setSpectators] =
        useState<SpectatorRow[]>(initialSpectators);
    const [role, setRole] = useState<Role>(initialRole);
    const [hostId, setHostId] = useState(initialHostId);
    const [botCount, setBotCount] = useState(initialBotCount);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
                .select("status, current_game_id, host_id, bot_count")
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
    }, [roomId, router, currentUserId]);

    // Auto-join when arriving via a shared link, then sync.
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

    const isHost = hostId === currentUserId;
    const total = seats.length + botCount;
    const canStart = isHost && total >= minPlayers && total <= maxPlayers;
    const isSpectator = role === "spectator";
    // No free player slot — a spectator can't claim a seat until one opens.
    const roomFull = total >= maxPlayers;

    async function setBots(next: number) {
        const clamped = Math.max(0, Math.min(next, maxPlayers - seats.length));
        setBotCount(clamped); // optimistic; Realtime reconciles
        await fetch(`/api/rooms/${code}/bots`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count: clamped }),
        });
    }

    function startErrorLabel(errorCode: unknown): string {
        if (errorCode === "not_host") return t("error_not_host");
        if (errorCode === "not_enough_players") return t("error_not_enough");
        if (errorCode === "already_started") return t("error_already_started");
        return t("error_generic");
    }

    async function start() {
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/rooms/${code}/start`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setBusy(false);
            setError(startErrorLabel(data.error));
            return;
        }
        router.push(`/game/${data.gameId}`);
    }

    async function leave() {
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/rooms/${code}/leave`, {
            method: "POST",
        });
        if (!res.ok) {
            // Stay in the room rather than ghosting a seat on the server.
            setBusy(false);
            setError(t("error_generic"));
            return;
        }
        closedRef.current = true;
        router.push("/lobby");
    }

    async function toggleRole() {
        const next: Role = role === "spectator" ? "player" : "spectator";
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/rooms/${code}/role`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: next }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(
                data.error === "room_full"
                    ? t("error_room_full")
                    : t("error_generic"),
            );
            setBusy(false);
            return;
        }
        setRole(next); // optimistic button state
        // Reconcile the rosters NOW rather than waiting on Realtime/the poll:
        // postgres_changes can be silent on self-hosted stacks, which would
        // otherwise leave you in the wrong column (still in seats / not yet in
        // spectators) until the next safety poll. One round-trip, instant.
        await refresh();
        setBusy(false);
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard unavailable (insecure context, denied permission) —
            // keep the "copy" label; the code stays selectable by hand.
        }
    }

    const slots: Slot[] = Array.from({ length: maxPlayers }, (_, i) => {
        if (i < seats.length) {
            return {
                kind: "human",
                username: seats[i].username,
                userId: seats[i].userId,
            };
        }
        if (i < seats.length + botCount) {
            return {
                kind: "bot",
                label: `${t("computer")} ${i - seats.length + 1}`,
            };
        }
        return null;
    });

    return (
        <div className="flex flex-col gap-6">
            <ReconnectingBanner status={conn} />
            {/* Code share */}
            <div
                className="rounded-2xl p-6 xl:p-8 flex flex-col items-center gap-3 text-center"
                style={{ background: "#1c1510", border: "2px solid #3d2d18" }}
            >
                <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    {moduleName} · {t("share_hint")}
                </span>
                <button
                    type="button"
                    onClick={copyCode}
                    className="text-5xl xl:text-6xl font-black tracking-[0.3em] transition-transform active:scale-95"
                    style={{ color: "#f5c516" }}
                >
                    {code}
                </button>
                <span
                    className="text-xs font-bold"
                    style={{ color: copied ? "#48c97a" : "#9a8870" }}
                >
                    {copied ? t("copied") : t("copy")}
                </span>
            </div>

            {/* Seats */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h3
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("seats")} · {total}/{maxPlayers}
                    </h3>
                    {isHost && (
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs font-bold"
                                style={{ color: "#9a8870" }}
                            >
                                {t("bots")}
                            </span>
                            <button
                                type="button"
                                onClick={() => setBots(botCount - 1)}
                                disabled={botCount <= 0}
                                className="flex h-7 w-7 items-center justify-center rounded-lg font-black disabled:opacity-30"
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    color: "#f5c516",
                                    border: "1px solid #3d2d18",
                                }}
                            >
                                −
                            </button>
                            <span
                                className="w-5 text-center font-black"
                                style={{ color: "#faf2e2" }}
                            >
                                {botCount}
                            </span>
                            <button
                                type="button"
                                onClick={() => setBots(botCount + 1)}
                                disabled={total >= maxPlayers}
                                className="flex h-7 w-7 items-center justify-center rounded-lg font-black disabled:opacity-30"
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    color: "#f5c516",
                                    border: "1px solid #3d2d18",
                                }}
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
                <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {slots.map((slot, index) => {
                        const filled = slot !== null;
                        const isBot = slot?.kind === "bot";
                        const label =
                            slot?.kind === "human"
                                ? slot.username
                                : slot?.kind === "bot"
                                  ? slot.label
                                  : t("empty_seat");
                        const key =
                            slot?.kind === "human"
                                ? slot.userId
                                : slot?.kind === "bot"
                                  ? `bot-${index}`
                                  : `empty-${index}`;
                        return (
                            <li
                                key={key}
                                className="flex items-center gap-3 rounded-xl px-4 py-3"
                                style={{
                                    background: filled
                                        ? "#1c1510"
                                        : "rgba(255,255,255,0.02)",
                                    border: `2px solid ${filled ? "#3d2d18" : "rgba(61,45,24,0.5)"}`,
                                }}
                            >
                                <div
                                    className="flex h-9 w-9 items-center justify-center rounded-full font-black"
                                    style={{
                                        background: isBot
                                            ? "rgba(167,139,250,0.15)"
                                            : filled
                                              ? "rgba(245,197,22,0.15)"
                                              : "transparent",
                                        color: isBot
                                            ? "#a78bfa"
                                            : filled
                                              ? "#f5c516"
                                              : "#4a3820",
                                        border: filled
                                            ? undefined
                                            : "1px dashed #4a3820",
                                    }}
                                >
                                    {isBot
                                        ? "🤖"
                                        : slot?.kind === "human"
                                          ? slot.username
                                                .charAt(0)
                                                .toUpperCase()
                                          : "?"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div
                                        className="truncate font-bold text-sm"
                                        style={{
                                            color: filled
                                                ? "#faf2e2"
                                                : "#4a3820",
                                        }}
                                    >
                                        {label}
                                    </div>
                                    {slot?.kind === "human" &&
                                        slot.userId === hostId && (
                                            <span
                                                className="text-[10px] font-black uppercase tracking-wider"
                                                style={{ color: "#f5c516" }}
                                            >
                                                {t("host_badge")}
                                            </span>
                                        )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Spectators — watch the live game, never dealt in */}
            <div className="flex flex-col gap-3">
                <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    {t("spectators")} · {spectators.length}
                </h3>
                {spectators.length === 0 ? (
                    <p
                        className="text-xs font-bold"
                        style={{ color: "#4a3820" }}
                    >
                        {t("no_spectators")}
                    </p>
                ) : (
                    <ul className="flex flex-wrap gap-2">
                        {spectators.map((s) => (
                            <li
                                key={s.userId}
                                className="flex items-center gap-2 rounded-xl px-3 py-2"
                                style={{
                                    background: "#1c1510",
                                    border: "1px solid #3d2d18",
                                }}
                            >
                                <span aria-hidden>👁</span>
                                <span
                                    className="truncate font-bold text-sm"
                                    style={{ color: "#9a8870" }}
                                >
                                    {s.username}
                                    {s.userId === hostId
                                        ? ` · ${t("host_badge")}`
                                        : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {error && (
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#e04040" }}
                >
                    {error}
                </p>
            )}

            {/* Spectator toggle — switch your own role between player and watcher */}
            <button
                type="button"
                onClick={toggleRole}
                disabled={busy || (isSpectator && roomFull)}
                className="rounded-xl py-3 font-bold text-sm disabled:opacity-50"
                style={{
                    background: isSpectator
                        ? "rgba(245,197,22,0.12)"
                        : "rgba(167,139,250,0.12)",
                    color: isSpectator ? "#f5c516" : "#a78bfa",
                    border: `1px solid ${
                        isSpectator
                            ? "rgba(245,197,22,0.4)"
                            : "rgba(167,139,250,0.4)"
                    }`,
                }}
            >
                {isSpectator
                    ? roomFull
                        ? t("room_full_short")
                        : t("join_as_player")
                    : t("spectate")}
            </button>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {isHost ? (
                    <button
                        type="button"
                        onClick={start}
                        disabled={busy || !canStart}
                        className="flex-1 rounded-xl py-3 font-black text-sm disabled:opacity-50"
                        style={{
                            background: "#48c97a",
                            color: "#0d1f12",
                            boxShadow: "0 4px 0 0 #1a6038",
                        }}
                    >
                        {busy
                            ? t("starting")
                            : canStart
                              ? t("start")
                              : t("need_more_players", { min: minPlayers })}
                    </button>
                ) : (
                    <div
                        className="flex-1 rounded-xl py-3 text-center font-bold text-sm"
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            color: "#9a8870",
                            border: "1px solid #3d2d18",
                        }}
                    >
                        {t("waiting_host")}
                    </div>
                )}
                <button
                    type="button"
                    onClick={leave}
                    disabled={busy}
                    className="rounded-xl px-6 py-3 font-bold text-sm disabled:opacity-50"
                    style={{
                        background: "rgba(224,64,64,0.12)",
                        color: "#e04040",
                        border: "1px solid rgba(224,64,64,0.4)",
                    }}
                >
                    {t("leave")}
                </button>
            </div>
        </div>
    );
}
