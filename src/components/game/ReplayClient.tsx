"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { GameTable } from "@/components/game/GameTable";
import { findPlayerName } from "@/components/game/playerName";
import { GameButton } from "@/components/ui/GameButton";
import { replayBoard } from "@/hooks/game/gamePayload";
import { useReplayPlayback } from "@/hooks/game/useReplayPlayback";
import { Link } from "@/i18n/navigation";
import { getBoardTheme } from "@/lib/board/themes";
import { getCardTheme } from "@/lib/card/themes";
import { getGameTable } from "@/lib/games";
import type { AnyGameTableConfig } from "@/lib/games/table/types";
import type { ReplayPayload } from "@/lib/models/replay";

interface Props {
    payload: ReplayPayload;
    currentUserId: string;
    deckStyleId: string;
    boardStyleId: string;
}

const AUTOPLAY_INTERVAL = 1100;
const WIDTH = "mx-auto w-full max-w-3xl lg:max-w-none";

const noop = () => {};

export function ReplayClient(props: Props) {
    const t = useTranslations("replay");
    const { payload } = props;
    const table = getGameTable(payload.moduleId);

    if (!table) {
        return (
            <div className="p-8 text-center" style={{ color: "var(--muted)" }}>
                {t("unknown_game")}
            </div>
        );
    }
    if (payload.steps.length === 0) {
        return (
            <ReplayNotice
                text={payload.diverged ? t("diverged") : t("expired")}
            />
        );
    }
    return <ReplayPlayer {...props} table={table} />;
}

function ReplayNotice({ text }: { text: string }) {
    const t = useTranslations("replay");
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 rounded-2xl p-10 text-center xl:max-w-5xl 2xl:max-w-7xl">
            <p className="text-5xl" aria-hidden="true">
                🗃️
            </p>
            <p
                className="text-sm font-semibold"
                style={{ color: "var(--muted)" }}
            >
                {text}
            </p>
            <GameButton href="/profile/history" variant="gold" size="sm">
                ← {t("back")}
            </GameButton>
        </div>
    );
}

function ReplayPlayer({
    payload,
    currentUserId,
    deckStyleId,
    boardStyleId,
    table,
}: Props & { table: AnyGameTableConfig }) {
    const t = useTranslations("replay");
    const tGame = useTranslations("game");
    const last = payload.steps.length - 1;
    const { index, playing, togglePlay, step, seek } = useReplayPlayback(
        last,
        AUTOPLAY_INTERVAL,
    );
    const board = useMemo(() => replayBoard(payload, index), [payload, index]);
    // An expired log only re-derives the deal (frame 0): nothing to play back.
    const notice = payload.expired
        ? t("expired")
        : payload.diverged
          ? t("diverged")
          : null;

    return (
        <div className="flex flex-col gap-3">
            <div className={`${WIDTH} flex items-center justify-between`}>
                <Link
                    href="/profile/history"
                    className="wc-link text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
                >
                    ← {t("back")}
                </Link>
                {payload.interruptedBy && (
                    <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--muted)" }}
                    >
                        {payload.interruptedBy === "forfeit"
                            ? t("forfeit_ended", {
                                  name:
                                      findPlayerName(
                                          payload.players,
                                          payload.forfeitedBy,
                                      ) ?? tGame("unknown_player"),
                              })
                            : payload.interruptedBy === "abandoned"
                              ? t("abandoned_ended")
                              : t("admin_ended")}
                    </span>
                )}
            </div>

            {notice && (
                <p
                    className={`${WIDTH} text-center text-xs font-semibold`}
                    style={{ color: "var(--muted)" }}
                >
                    {notice}
                </p>
            )}

            <GameTable
                table={table}
                payload={board}
                currentUserId={currentUserId}
                deckTheme={getCardTheme(deckStyleId)}
                boardTheme={getBoardTheme(boardStyleId)}
                pending={false}
                onAction={noop}
                onIllegal={noop}
            />

            {last > 0 && (
                <div
                    className={`${WIDTH} panel-d flex flex-col gap-3 p-3 sm:p-4`}
                >
                    <div className="flex items-center gap-3">
                        <GameButton
                            variant="ghost"
                            size="sm"
                            onClick={() => step(-1)}
                            disabled={index <= 0}
                            ariaLabel={t("prev_move")}
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
                            ariaLabel={t("next_move")}
                        >
                            ⏭
                        </GameButton>
                        <span
                            className="ml-auto text-sm font-black tabular-nums"
                            style={{ color: "var(--cream)" }}
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
            )}
        </div>
    );
}
