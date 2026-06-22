"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OngoingGame } from "@/lib/models/admin";
import { ADMIN } from "./adminTheme";

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
        <li
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-3.5"
            style={{
                background: "rgba(0,0,0,0.25)",
                border: `1px solid ${ADMIN.border}`,
            }}
        >
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className="text-sm font-black"
                        style={{ color: ADMIN.text }}
                    >
                        {g.moduleName}
                    </span>
                    <span
                        className="text-[11px] font-black px-2 py-0.5 rounded-md font-mono tracking-wider"
                        style={{
                            background: "rgba(245,197,22,0.12)",
                            color: "#f5c516",
                        }}
                    >
                        {g.roomCode}
                    </span>
                    <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                        style={{
                            background: "rgba(167,139,250,0.12)",
                            color: "#a78bfa",
                        }}
                    >
                        {t("phase")}: {g.phase}
                    </span>
                </div>
                <div
                    className="flex items-center gap-3 flex-wrap text-xs font-semibold"
                    style={{ color: ADMIN.textSubtle }}
                >
                    <span>
                        {t("players_count", { count: g.playerCount })}
                        {g.botCount > 0 &&
                            ` · ${t("bots_count", { count: g.botCount })}`}
                    </span>
                    {g.currentPlayerName && (
                        <span>
                            {t("current_turn")}:{" "}
                            <span style={{ color: ADMIN.text }}>
                                {g.currentPlayerName}
                            </span>
                        </span>
                    )}
                    <span style={{ color: ADMIN.textMuted }}>
                        {relativeTime(locale, g.startedAt, now)}
                    </span>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Link
                    href={`/game/${g.gameId}`}
                    className="text-xs font-black px-4 py-2 rounded-lg transition-colors"
                    style={{
                        background: "rgba(72,201,122,0.12)",
                        color: ADMIN.success,
                        border: "1px solid rgba(72,201,122,0.25)",
                    }}
                >
                    {t("watch")}
                </Link>
                {canEnd && (
                    <button
                        type="button"
                        onClick={() => onEnd(g)}
                        disabled={endingId === g.gameId}
                        className="text-xs font-black px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                        style={{
                            background: "rgba(224,64,64,0.12)",
                            color: ADMIN.danger,
                            border: "1px solid rgba(224,64,64,0.3)",
                        }}
                    >
                        {endingId === g.gameId
                            ? tCommon("saving")
                            : t("end_game")}
                    </button>
                )}
            </div>
        </li>
    );
}
