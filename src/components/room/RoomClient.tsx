"use client";

import { useTranslations } from "next-intl";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { ReconnectingBanner } from "@/components/ui/ReconnectingBanner";
import { useRoomControls } from "@/hooks/lobby/useRoomControls";
import { useRoomRefresh } from "@/hooks/lobby/useRoomRefresh";
import {
    type GameRuleMode,
    type GameRuleToggle,
    matchRuleMode,
} from "@/lib/engine/types";
import type { Role, SeatRow, Slot, SpectatorRow } from "@/lib/lobby/roster";
import { RoomActions } from "./RoomActions";
import { RoomCodeCard } from "./RoomCodeCard";
import { RuleModePicker } from "./RuleModePicker";
import { RuleToggle } from "./RuleToggle";
import { SeatPanel } from "./SeatPanel";
import { SpectatorList } from "./SpectatorList";

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

    const controls = useRoomControls({
        code,
        maxPlayers,
        seatCount: seats.length,
        botCount,
        setBotCount,
        rules,
        setRules,
        ruleToggles,
        role,
        setRole,
        refresh,
        closedRef,
        mutatingRef,
    });
    const { busy, settingsBusy, error } = controls;

    const isHost = hostId === currentUserId;
    const total = seats.length + botCount;
    const canStart = isHost && total >= minPlayers && total <= maxPlayers;
    const isSpectator = role === "spectator";
    const roomFull = total >= maxPlayers;

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
        <div className="flex flex-col gap-5">
            <ReconnectingBanner status={conn} />
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-5">
                    <RoomCodeCard code={code} moduleName={moduleName} />
                    <SeatPanel
                        slots={slots}
                        total={total}
                        maxPlayers={maxPlayers}
                        hostId={hostId}
                        isHost={isHost}
                        botCount={botCount}
                        onSetBots={controls.setBots}
                    />
                </div>

                <div className="flex flex-col gap-5">
                    {(ruleModes.length > 0 || ruleToggles.length > 0) && (
                        <section className="panel flex flex-col gap-4 p-5">
                            {ruleModes.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <h2 className="h-lg">{t("mode_title")}</h2>
                                    <RuleModePicker
                                        modes={ruleModes}
                                        activeKey={
                                            matchRuleMode(
                                                ruleModes,
                                                ruleToggles,
                                                rules,
                                            )?.key ?? null
                                        }
                                        isHost={isHost}
                                        busy={busy || settingsBusy}
                                        onPick={controls.pickMode}
                                    />
                                </div>
                            )}
                            {ruleToggles.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <h2 className="h-lg">{t("rules_title")}</h2>
                                    <ul className="flex flex-col gap-2">
                                        {ruleToggles.map((toggle) => (
                                            <RuleToggle
                                                key={toggle.key}
                                                label={ruleText(
                                                    toggle.key,
                                                    "label",
                                                )}
                                                description={ruleText(
                                                    toggle.key,
                                                    "description",
                                                )}
                                                on={rules[toggle.key]}
                                                locked={
                                                    toggle.requires
                                                        ? !rules[
                                                              toggle.requires
                                                          ]
                                                        : false
                                                }
                                                isHost={isHost}
                                                busy={busy || settingsBusy}
                                                onToggle={(value) =>
                                                    controls.setRule(
                                                        toggle.key,
                                                        value,
                                                    )
                                                }
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    <SpectatorList spectators={spectators} hostId={hostId} />

                    {error && <ErrorBanner>{error}</ErrorBanner>}

                    <GameButton
                        variant={isSpectator ? "gold" : "purple"}
                        onClick={controls.toggleRole}
                        disabled={busy || (isSpectator && roomFull)}
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
                        onStart={controls.start}
                        onLeave={controls.leave}
                    />
                </div>
            </div>
        </div>
    );
}
