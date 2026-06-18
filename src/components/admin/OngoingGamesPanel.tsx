"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { Link } from "@/i18n/navigation";
import type { OngoingGame } from "@/lib/models/admin";

const REFRESH_MS = 10_000;

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
    games: OngoingGame[];
};

/**
 * Moderator view of every live game. The list is server-rendered (the page
 * reads it on the caller's RLS-scoped client); this wrapper keeps it fresh by
 * polling `router.refresh()` on an interval and ticks a clock so the "started"
 * times stay relative without re-fetching.
 */
export function OngoingGamesPanel({ games }: Props) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const router = useRouter();
    const [now, setNow] = useState(() => Date.now());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const clock = setInterval(() => setNow(Date.now()), 1000);
        const poll = setInterval(() => router.refresh(), REFRESH_MS);
        return () => {
            clearInterval(clock);
            clearInterval(poll);
        };
    }, [router]);

    function refreshNow() {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 600);
    }

    return (
        <section
            className="rounded-2xl p-5 xl:p-6 flex flex-col gap-4"
            style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #2a1e0f",
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <h2
                        className="text-lg xl:text-xl font-black"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("ongoing_title")}
                    </h2>
                    <span
                        className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{
                            background: "rgba(72,201,122,0.15)",
                            color: "#48c97a",
                            border: "1px solid rgba(72,201,122,0.25)",
                        }}
                    >
                        {games.length}
                    </span>
                </div>
                <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={refreshNow}
                    disabled={refreshing}
                >
                    {t("refresh")}
                </GameButton>
            </div>

            {games.length === 0 ? (
                <p
                    className="text-sm font-semibold py-8 text-center"
                    style={{ color: "#7a6a50" }}
                >
                    {t("no_games")}
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {games.map((g) => (
                        <li
                            key={g.gameId}
                            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-3.5"
                            style={{
                                background: "rgba(0,0,0,0.25)",
                                border: "1px solid #2a1e0f",
                            }}
                        >
                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className="text-sm font-black"
                                        style={{ color: "#faf2e2" }}
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
                                            background:
                                                "rgba(167,139,250,0.12)",
                                            color: "#a78bfa",
                                        }}
                                    >
                                        {t("phase")}: {g.phase}
                                    </span>
                                </div>
                                <div
                                    className="flex items-center gap-3 flex-wrap text-xs font-semibold"
                                    style={{ color: "#9a8870" }}
                                >
                                    <span>
                                        {t("players_count", {
                                            count: g.playerCount,
                                        })}
                                        {g.botCount > 0 &&
                                            ` · ${t("bots_count", { count: g.botCount })}`}
                                    </span>
                                    {g.currentPlayerName && (
                                        <span>
                                            {t("current_turn")}:{" "}
                                            <span style={{ color: "#faf2e2" }}>
                                                {g.currentPlayerName}
                                            </span>
                                        </span>
                                    )}
                                    <span style={{ color: "#7a6a50" }}>
                                        {relativeTime(locale, g.startedAt, now)}
                                    </span>
                                </div>
                            </div>
                            <Link
                                href={`/game/${g.gameId}`}
                                className="shrink-0 text-xs font-black px-4 py-2 rounded-lg transition-colors"
                                style={{
                                    background: "rgba(72,201,122,0.12)",
                                    color: "#48c97a",
                                    border: "1px solid rgba(72,201,122,0.25)",
                                }}
                            >
                                {t("watch")}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
