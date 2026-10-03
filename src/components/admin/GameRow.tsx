"use client";

import { useFormatter, useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { OngoingGame } from "@/lib/models/admin";

type Props = {
    game: OngoingGame;
    canEnd: boolean;
    /** Client clock; `null` until mounted (relative time is client-only). */
    now: number | null;
    endingId: string | null;
    onEnd: (game: OngoingGame) => void;
};

export function GameRow({ game: g, canEnd, now, endingId, onEnd }: Props) {
    const t = useTranslations("admin");
    const tCommon = useTranslations("common");
    const format = useFormatter();

    return (
        <li className="panel flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base leading-none">
                        {g.moduleName}
                    </span>
                    <span
                        className="stamp"
                        style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                        }}
                    >
                        {g.roomCode}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-wc-muted">
                    <span>{t("players_count", { count: g.playerCount })}</span>
                    {g.botCount > 0 && (
                        <span>{t("bots_count", { count: g.botCount })}</span>
                    )}
                    {(g.currentPlayerName || g.currentIsBot) && (
                        <span>
                            {t.rich("current_turn", {
                                name: g.currentIsBot
                                    ? t("bot_turn")
                                    : (g.currentPlayerName ?? ""),
                                b: (chunks) => (
                                    <span className="text-wc-cream">
                                        {chunks}
                                    </span>
                                ),
                            })}
                        </span>
                    )}
                    {now !== null && (
                        <span>
                            {format.relativeTime(new Date(g.startedAt), now)}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <GameButton
                    href={`/game/${g.gameId}`}
                    variant="green"
                    size="sm"
                >
                    {t("watch")}
                </GameButton>
                {canEnd && (
                    <GameButton
                        variant="red"
                        size="sm"
                        onClick={() => onEnd(g)}
                        disabled={endingId === g.gameId}
                    >
                        {endingId === g.gameId
                            ? tCommon("saving")
                            : t("end_game")}
                    </GameButton>
                )}
            </div>
        </li>
    );
}
