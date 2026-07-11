"use client";

import { useLocale, useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { OngoingGame } from "@/lib/models/admin";

/** Localised "il y a 3 min" from an ISO timestamp, given a clock tick. */
function relativeTime(locale: string, iso: string, now: number): string {
    const diffSec = Math.max(
        0,
        Math.round((now - new Date(iso).getTime()) / 1000),
    );
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (diffSec < 60) return rtf.format(-diffSec, "second");
    if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), "minute");
    return rtf.format(-Math.floor(diffSec / 3600), "hour");
}

type Props = {
    game: OngoingGame;
    canEnd: boolean;
    now: number;
    endingId: string | null;
    onEnd: (game: OngoingGame) => void;
};

export function GameRow({ game: g, canEnd, now, endingId, onEnd }: Props) {
    const t = useTranslations("admin");
    const tCommon = useTranslations("common");
    const locale = useLocale();

    return (
        <li className="panel flex flex-col sm:flex-row sm:items-center gap-3 p-3.5">
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className="font-display text-base leading-none"
                        style={{ color: "var(--ink)" }}
                    >
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
                    <span
                        className="stamp"
                        style={{
                            background: "var(--purple)",
                            color: "var(--accent-ink)",
                        }}
                    >
                        {t("phase")}: {g.phase}
                    </span>
                </div>
                <div
                    className="flex items-center gap-3 flex-wrap text-xs font-semibold"
                    style={{ color: "#5a5340" }}
                >
                    <span>
                        {t("players_count", { count: g.playerCount })}
                        {g.botCount > 0 &&
                            ` · ${t("bots_count", { count: g.botCount })}`}
                    </span>
                    {g.currentPlayerName && (
                        <span>
                            {t("current_turn")}:{" "}
                            <span style={{ color: "var(--ink)" }}>
                                {g.currentPlayerName}
                            </span>
                        </span>
                    )}
                    <span style={{ color: "#5a5340" }}>
                        {relativeTime(locale, g.startedAt, now)}
                    </span>
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
