"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { useRoomRefresh } from "@/hooks/lobby/useRoomRefresh";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";
import {
    type GameRuleMode,
    type GameRuleToggle,
    matchRuleMode,
    resolveRuleToggles,
    ruleModeValues,
} from "@/lib/engine/types";
import { RoomActions } from "./room/RoomActions";
import { RuleModePicker } from "./room/RuleModePicker";
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
    ruleModes: readonly GameRuleMode[];
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
    ruleModes,
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
        mutatingRef,
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

    // Host setting mutations in flight — gates the +/- and toggles so a second
    // click can't race the first, and holds off poll overwrites meanwhile.
    const [settingsBusy, setSettingsBusy] = useState(false);
    const copiedTimer = useRef<number | null>(null);
    useEffect(
        () => () => {
            if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
        },
        [],
    );

    /** Optimistic host mutation: apply, POST, roll back on refusal, reconcile. */
    async function mutateSetting(
        apply: () => () => void,
        request: () => Promise<Response>,
    ) {
        if (settingsBusy) return;
        setSettingsBusy(true);
        setError(null);
        mutatingRef.current += 1;
        const rollback = apply();
        try {
            const res = await request();
            if (!res.ok) {
                rollback();
                setError(apiErrorLabel(await errorCodeOf(res)));
            }
        } catch {
            rollback();
            setError(t("error_generic"));
        } finally {
            mutatingRef.current -= 1;
            setSettingsBusy(false);
        }
        await refresh().catch(() => {});
    }

    function setBots(next: number) {
        const clamped = Math.max(0, Math.min(next, maxPlayers - seats.length));
        if (clamped === botCount) return;
        const previous = botCount;
        return mutateSetting(
            () => {
                setBotCount(clamped);
                return () => setBotCount(previous);
            },
            () =>
                apiFetch(`/api/rooms/${code}/bots`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ count: clamped }),
                }),
        );
    }

    function setRule(key: string, value: boolean) {
        // Resolve locally so a dependency flip shows instantly; server re-resolves.
        return saveRules(
            resolveRuleToggles(ruleToggles, { ...rules, [key]: value }),
        );
    }

    /** A mode is just a full toggle map — saved through the same route. */
    function pickMode(mode: GameRuleMode) {
        return saveRules(ruleModeValues(ruleToggles, mode));
    }

    function saveRules(next: Record<string, boolean>) {
        const previous = rules;
        return mutateSetting(
            () => {
                setRules(next);
                return () => setRules(previous);
            },
            () =>
                apiFetch(`/api/rooms/${code}/rules`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rules: next }),
                }),
        );
    }

    /** Platform-wide refusals any mutating room route can answer with. */
    function apiErrorLabel(errorCode: unknown): string {
        if (errorCode === "rate_limited") return t("error_rate_limited");
        if (errorCode === "maintenance") return t("error_maintenance");
        if (errorCode === "room_full") return t("error_room_full");
        return t("error_generic");
    }

    function startErrorLabel(errorCode: unknown): string {
        if (errorCode === "not_host") return t("error_not_host");
        if (errorCode === "not_enough_players") return t("error_not_enough");
        if (errorCode === "already_started") return t("error_already_started");
        return apiErrorLabel(errorCode);
    }

    async function errorCodeOf(res: Response): Promise<unknown> {
        const data = (await res.json().catch(() => ({}))) as {
            error?: unknown;
        };
        return data.error;
    }

    async function start() {
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/rooms/${code}/start`, {
                method: "POST",
            });
            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
                gameId?: string;
            };
            if (!res.ok || !data.gameId) {
                setError(startErrorLabel(data.error));
                setBusy(false);
                return;
            }
            // Stay busy while navigating so Start can't be pressed twice.
            router.push(`/game/${data.gameId}`);
        } catch {
            setError(t("error_generic"));
            setBusy(false);
        }
    }

    async function leave() {
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/rooms/${code}/leave`, {
                method: "POST",
            });
            if (!res.ok) {
                setError(apiErrorLabel(await errorCodeOf(res)));
                setBusy(false);
                return;
            }
            closedRef.current = true;
            router.push("/lobby");
        } catch {
            setError(t("error_generic"));
            setBusy(false);
        }
    }

    async function toggleRole() {
        const next: Role = role === "spectator" ? "player" : "spectator";
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/rooms/${code}/role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: next }),
            });
            if (!res.ok) {
                setError(apiErrorLabel(await errorCodeOf(res)));
                return;
            }
            setRole(next); // optimistic button state
            // Reconcile now: postgres_changes can be silent on self-hosted
            // stacks, leaving you in the wrong column until the next poll.
            await refresh();
        } catch {
            setError(t("error_generic"));
        } finally {
            setBusy(false);
        }
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => {
                setCopied(false);
                copiedTimer.current = null;
            }, 1500);
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
            <div className="panel-d flex flex-col items-center gap-3 p-6 text-center xl:p-8">
                <span
                    className="stamp max-w-full text-center"
                    style={{
                        background: "var(--cream)",
                        color: "var(--ink)",
                        whiteSpace: "normal",
                    }}
                >
                    {moduleName} · {t("share_hint")}
                </span>
                <button
                    type="button"
                    onClick={copyCode}
                    className="font-display text-5xl tracking-[0.25em] transition-transform active:scale-95 xl:text-6xl"
                    style={{ color: "var(--gold)" }}
                >
                    {code}
                </button>
                <span
                    className="font-display text-xs"
                    style={{ color: copied ? "var(--green)" : "var(--muted)" }}
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

            {ruleModes.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h3
                        className="font-display text-base"
                        style={{ color: "var(--cream)" }}
                    >
                        {t("mode_title")}
                    </h3>
                    <RuleModePicker
                        modes={ruleModes}
                        activeKey={
                            matchRuleMode(ruleModes, ruleToggles, rules)?.key ??
                            null
                        }
                        isHost={isHost}
                        busy={busy || settingsBusy}
                        onPick={pickMode}
                    />
                </div>
            )}

            {ruleToggles.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h3
                        className="font-display text-base"
                        style={{ color: "var(--cream)" }}
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
                                busy={busy || settingsBusy}
                                onToggle={(value) => setRule(toggle.key, value)}
                            />
                        ))}
                    </ul>
                </div>
            )}

            <SpectatorList spectators={spectators} hostId={hostId} />

            {error && (
                <p
                    className="font-display text-sm"
                    style={{ color: "var(--red)" }}
                >
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={toggleRole}
                disabled={busy || (isSpectator && roomFull)}
                className="wc-btn py-3 text-sm"
                style={{
                    background: isSpectator ? "var(--gold)" : "var(--purple)",
                    color: isSpectator ? "var(--ink)" : "var(--accent-ink)",
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
