"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { useRoomRefresh } from "@/hooks/lobby/useRoomRefresh";
import { useApiErrorLabel } from "@/hooks/useApiErrorLabel";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, readApiError, readApiJson } from "@/lib/api/client";
import {
    type GameRuleMode,
    type GameRuleToggle,
    matchRuleMode,
    resolveRuleToggles,
    ruleModeValues,
} from "@/lib/engine/types";
import type { Role, SeatRow, Slot, SpectatorRow } from "@/lib/lobby/roster";
import { RoomActions } from "./room/RoomActions";
import { RuleModePicker } from "./room/RuleModePicker";
import { RuleToggle } from "./room/RuleToggle";
import { SeatPanel } from "./room/SeatPanel";
import { SpectatorList } from "./room/SpectatorList";

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
    isMember: boolean;
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
    isMember,
    initialRole,
    ruleToggles,
    ruleModes,
    initialRules,
}: Props) {
    const t = useTranslations("room");
    const tCommon = useTranslations("common");
    const errorLabel = useApiErrorLabel();
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
        isMember,
    });

    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isHost = hostId === currentUserId;
    const total = seats.length + botCount;
    const canStart = isHost && total >= minPlayers && total <= maxPlayers;
    const isSpectator = role === "spectator";
    const roomFull = total >= maxPlayers;

    const [settingsBusy, setSettingsBusy] = useState(false);
    // Synchronous guard: a second click fired before the re-render would still see settingsBusy=false.
    const settingsInFlight = useRef(false);
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
        if (settingsInFlight.current) return;
        settingsInFlight.current = true;
        setSettingsBusy(true);
        setError(null);
        mutatingRef.current += 1;
        const rollback = apply();
        try {
            const res = await request();
            if (!res.ok) {
                rollback();
                setError(errorLabel(await readApiError(res)));
            }
        } catch {
            rollback();
            setError(errorLabel(null));
        } finally {
            mutatingRef.current -= 1;
            settingsInFlight.current = false;
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

    function setRule(key: string, value: boolean) {
        // Resolved locally so a dependency flip shows instantly; the server re-resolves.
        return saveRules(
            resolveRuleToggles(ruleToggles, { ...rules, [key]: value }),
        );
    }

    function pickMode(mode: GameRuleMode) {
        return saveRules(ruleModeValues(ruleToggles, mode));
    }

    async function start() {
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/rooms/${code}/start`, {
                method: "POST",
            });
            const data = await readApiJson<{
                error?: string;
                gameId?: string;
            }>(res);
            if (!res.ok || !data?.gameId) {
                setError(errorLabel(data?.error));
                setBusy(false);
                return;
            }
            // Stay busy while navigating so Start can't be pressed twice.
            router.push(`/game/${data.gameId}`);
        } catch {
            setError(errorLabel(null));
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
                setError(errorLabel(await readApiError(res)));
                setBusy(false);
                return;
            }
            closedRef.current = true;
            router.push("/lobby");
        } catch {
            setError(errorLabel(null));
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
                setError(errorLabel(await readApiError(res)));
                return;
            }
            setRole(next);
            // postgres_changes can be silent on self-hosted stacks: reconcile now, not at the next poll.
            await refresh();
        } catch {
            setError(errorLabel(null));
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
            // Clipboard denied (insecure context): the code stays selectable by hand.
        }
    }

    // Rule keys come from the game module, so the message key is dynamic.
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
                label: tCommon("computer", { n: i - seats.length + 1 }),
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
                    {t("share_title", { game: moduleName })}
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
                    <h3 className="font-display text-base text-wc-cream">
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
                    <h3 className="font-display text-base text-wc-cream">
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

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <GameButton
                variant={isSpectator ? "gold" : "purple"}
                size="sm"
                onClick={toggleRole}
                disabled={busy || (isSpectator && roomFull)}
                className="py-3"
            >
                {isSpectator
                    ? roomFull
                        ? t("room_full_short")
                        : t("join_as_player")
                    : t("spectate")}
            </GameButton>

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
