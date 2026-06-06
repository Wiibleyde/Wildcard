"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useRoomChannel } from "@/lib/realtime/useRoomChannel";
import { createClient } from "@/lib/supabase/client";

export interface SeatRow {
    userId: string;
    username: string;
    seat: number;
}

interface Props {
    roomId: string;
    code: string;
    moduleName: string;
    minPlayers: number;
    maxPlayers: number;
    currentUserId: string;
    initialSeats: SeatRow[];
    initialHostId: string;
    initialBotCount: number;
    seated: boolean;
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
    initialHostId,
    initialBotCount,
    seated,
}: Props) {
    const t = useTranslations("room");
    const router = useRouter();
    const [seats, setSeats] = useState<SeatRow[]>(initialSeats);
    const [hostId, setHostId] = useState(initialHostId);
    const [botCount, setBotCount] = useState(initialBotCount);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const joinedRef = useRef(seated);

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
                .select("user_id, seat")
                .eq("room_id", roomId)
                .order("seat", { ascending: true }),
        ]);

        if (room?.status === "playing" && room.current_game_id) {
            router.push(`/game/${room.current_game_id}`);
            return;
        }
        if (room?.host_id) setHostId(room.host_id);
        if (typeof room?.bot_count === "number") setBotCount(room.bot_count);

        const rows = players ?? [];
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username")
            .in(
                "id",
                rows.map((r) => r.user_id),
            );
        const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.username]));
        setSeats(
            rows.map((r) => ({
                userId: r.user_id,
                seat: r.seat,
                username: nameOf.get(r.user_id) ?? "Joueur",
            })),
        );
    }, [roomId, router]);

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

    useRoomChannel(roomId, refresh);

    const isHost = hostId === currentUserId;
    const total = seats.length + botCount;
    const canStart = isHost && total >= minPlayers && total <= maxPlayers;

    async function setBots(next: number) {
        const clamped = Math.max(0, Math.min(next, maxPlayers - seats.length));
        setBotCount(clamped); // optimistic; Realtime reconciles
        await fetch(`/api/rooms/${code}/bots`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count: clamped }),
        });
    }

    async function start() {
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/rooms/${code}/start`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
            setBusy(false);
            setError(
                data.error === "not_host"
                    ? t("error_not_host")
                    : t("error_not_enough"),
            );
            return;
        }
        router.push(`/game/${data.gameId}`);
    }

    async function leave() {
        setBusy(true);
        await fetch(`/api/rooms/${code}/leave`, { method: "POST" });
        router.push("/lobby");
    }

    function copyCode() {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
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

            {error && (
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#e04040" }}
                >
                    {error}
                </p>
            )}

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
