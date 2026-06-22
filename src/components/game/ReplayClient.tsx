"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { GameTable } from "@/components/game/GameTable";
import { GameButton } from "@/components/ui/GameButton";
import { useReplayPlayback } from "@/hooks/game/useReplayPlayback";
import { Link } from "@/i18n/navigation";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import { THEMES } from "@/lib/card/themes";
import { freeTheme } from "@/lib/card/themes/free";
import { getGameTable } from "@/lib/games";
import type { GameClientPayload, GameLogEntry } from "@/lib/models/game";
import type { ReplayPayload } from "@/lib/models/replay";

interface Props {
    payload: ReplayPayload;
    currentUserId: string;
    deckStyleId: string;
    boardStyleId: string;
}

const AUTOPLAY_INTERVAL = 1100;

const noop = () => {};

export function ReplayClient({
    payload,
    currentUserId,
    deckStyleId,
    boardStyleId,
}: Props) {
    const t = useTranslations("replay");
    const last = payload.steps.length - 1;
    const { index, playing, togglePlay, step, seek } = useReplayPlayback(
        last,
        AUTOPLAY_INTERVAL,
    );

    const framePayload: GameClientPayload = useMemo(() => {
        const step = payload.steps[index];
        const log: GameLogEntry[] = [];
        for (let i = 1; i <= index; i++) {
            const s = payload.steps[i];
            log.push({ seq: i, actorId: s.actorId ?? "", events: s.events });
        }
        return {
            gameId: payload.gameId,
            moduleId: payload.moduleId,
            version: index,
            phase: step.phase,
            isOver: step.isOver,
            currentPlayerId: step.currentPlayerId,
            view: step.view,
            legalActions: [],
            outcome: step.outcome,
            players: payload.players,
            log,
            viewerId: payload.viewerId,
        };
    }, [payload, index]);

    // Moves pruned by the 15-day retention sweep — nothing left to replay.
    if (payload.expired) {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 rounded-2xl p-10 text-center xl:max-w-5xl 2xl:max-w-7xl">
                <p className="text-5xl" aria-hidden="true">
                    🗃️
                </p>
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#9a8870" }}
                >
                    {t("expired")}
                </p>
                <Link
                    href="/profile/history"
                    className="rounded-lg px-4 py-2 font-black text-sm"
                    style={{
                        background: "rgba(245,197,22,0.12)",
                        border: "2px solid rgba(245,197,22,0.3)",
                        color: "#f5c516",
                    }}
                >
                    ← {t("back")}
                </Link>
            </div>
        );
    }

    const boardTheme = BOARD_THEMES[boardStyleId] ?? greenFeltTheme;
    const table = getGameTable(payload.moduleId);
    if (!table) {
        return (
            <div className="p-8 text-center" style={{ color: "#9a8870" }}>
                {payload.moduleId}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between xl:max-w-5xl 2xl:max-w-7xl">
                <Link
                    href="/profile/history"
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    ← {t("back")}
                </Link>
                {payload.adminEnded && (
                    <span
                        className="text-xs font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {t("admin_ended")}
                    </span>
                )}
            </div>

            <GameTable
                table={table}
                view={framePayload.view}
                payload={framePayload}
                currentUserId={currentUserId}
                deckTheme={THEMES[deckStyleId] ?? freeTheme}
                boardTheme={boardTheme}
                pending={false}
                onAction={noop}
                onIllegal={noop}
            />

            <div
                className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl p-3 sm:p-4 xl:max-w-5xl 2xl:max-w-7xl"
                style={{ background: "#1c1510", border: "2px solid #3d2d18" }}
            >
                <div className="flex items-center gap-3">
                    <GameButton
                        variant="ghost"
                        size="sm"
                        onClick={() => step(-1)}
                        disabled={index <= 0}
                    >
                        ⏮
                    </GameButton>
                    <GameButton size="sm" onClick={togglePlay}>
                        {playing ? `⏸ ${t("pause")}` : `▶ ${t("play")}`}
                    </GameButton>
                    <GameButton
                        variant="ghost"
                        size="sm"
                        onClick={() => step(1)}
                        disabled={index >= last}
                    >
                        ⏭
                    </GameButton>
                    <span
                        className="ml-auto text-sm font-black tabular-nums"
                        style={{ color: "#faf2e2" }}
                    >
                        {index === 0
                            ? t("deal")
                            : t("move", { n: index, total: last })}
                    </span>
                </div>

                <input
                    type="range"
                    min={0}
                    max={last}
                    value={index}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="w-full accent-wc-gold"
                    aria-label={t("scrub")}
                />
            </div>
        </div>
    );
}
