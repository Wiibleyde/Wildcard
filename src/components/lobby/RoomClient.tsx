"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { useRoomRefresh } from "@/hooks/lobby/useRoomRefresh";
import { useRouter } from "@/i18n/navigation";
import { type GameRuleToggle, resolveRuleToggles } from "@/lib/engine/types";
import { RoomActions } from "./room/RoomActions";
import { RuleToggle } from "./room/RuleToggle";
import { SeatPanel } from "./room/SeatPanel";
import { SpectatorList } from "./room/SpectatorList";
import type { Role, SeatRow, Slot, SpectatorRow } from "./room/types";

export type { SeatRow, SpectatorRow } from "./room/types";

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
    ruleToggles: readonly GameRuleToggle[];
    initialRules: Record<string, boolean>;
}

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
    ruleToggles,
    initialRules,
}: Props) {
    const t = useTranslations("room");
    const router = useRouter();

    const {
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
    } = useRoomRefresh({
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
    });

    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isHost = hostId === currentUserId;
    const total = seats.length + botCount;
    const canStart = isHost && total >= minPlayers && total <= maxPlayers;
    const isSpectator = role === "spectator";
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

    async function setRule(key: string, value: boolean) {
        // Resolve locally so a dependency flip shows instantly; server re-resolves.
        const next = resolveRuleToggles(ruleToggles, {
            ...rules,
            [key]: value,
        });
        setRules(next); // optimistic; Realtime reconciles
        await fetch(`/api/rooms/${code}/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rules: next }),
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
        const res = await fetch(`/api/rooms/${code}/leave`, { method: "POST" });
        if (!res.ok) {
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
        // Reconcile now: postgres_changes can be silent on self-hosted stacks,
        // leaving you in the wrong column until the next safety poll.
        await refresh();
        setBusy(false);
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard unavailable (insecure context / denied) — code stays selectable by hand.
        }
    }

    // next-intl types keys as a literal union, so cast the dynamic key to that param type.
    const ruleText = (key: string, field: "label" | "description") =>
        t(`rules.${key}.${field}` as Parameters<typeof t>[0]);

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

            <SeatPanel
                slots={slots}
                total={total}
                maxPlayers={maxPlayers}
                hostId={hostId}
                isHost={isHost}
                botCount={botCount}
                onSetBots={setBots}
            />

            {ruleToggles.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h3
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("rules_title")}
                    </h3>
                    <ul className="flex flex-col gap-2">
                        {ruleToggles.map((toggle) => (
                            <RuleToggle
                                key={toggle.key}
                                label={ruleText(toggle.key, "label")}
                                description={ruleText(
                                    toggle.key,
                                    "description",
                                )}
                                on={rules[toggle.key]}
                                locked={
                                    toggle.requires
                                        ? !rules[toggle.requires]
                                        : false
                                }
                                isHost={isHost}
                                busy={busy}
                                onToggle={(value) => setRule(toggle.key, value)}
                            />
                        ))}
                    </ul>
                </div>
            )}

            <SpectatorList spectators={spectators} hostId={hostId} />

            {error && (
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#e04040" }}
                >
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={toggleRole}
                disabled={busy || (isSpectator && roomFull)}
                className="rounded-xl py-3 font-bold text-sm disabled:opacity-50"
                style={{
                    background: isSpectator
                        ? "rgba(245,197,22,0.12)"
                        : "rgba(167,139,250,0.12)",
                    color: isSpectator ? "#f5c516" : "#26ccba",
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

            <RoomActions
                isHost={isHost}
                busy={busy}
                canStart={canStart}
                minPlayers={minPlayers}
                onStart={start}
                onLeave={leave}
            />
        </div>
    );
}
