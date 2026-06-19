"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { MatchHistoryEntry, MatchResult } from "@/lib/models/history";

interface Props {
    entries: readonly MatchHistoryEntry[];
}

const RESULT_STYLE: Record<
    MatchResult,
    { bg: string; border: string; fg: string }
> = {
    win: {
        bg: "rgba(72,201,122,0.12)",
        border: "rgba(72,201,122,0.4)",
        fg: "#48c97a",
    },
    loss: {
        bg: "rgba(224,64,64,0.12)",
        border: "rgba(224,64,64,0.4)",
        fg: "#e04040",
    },
    none: { bg: "rgba(255,255,255,0.04)", border: "#3d2d18", fg: "#9a8870" },
};

export function MatchHistoryClient({ entries }: Props) {
    const t = useTranslations("history");
    const locale = useLocale();
    const [game, setGame] = useState("all");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // Filter options = only the games the player has actually played.
    const games = useMemo(() => {
        const seen = new Map<string, string>();
        for (const e of entries) seen.set(e.moduleId, e.moduleName);
        return [...seen].map(([id, name]) => ({ id, name }));
    }, [entries]);

    const filtered = useMemo(() => {
        const fromMs = from ? new Date(from).getTime() : null;
        // `to` is a day → include the whole day by pushing to its end.
        const toMs = to ? new Date(to).getTime() + 86_400_000 : null;
        return entries.filter((e) => {
            if (game !== "all" && e.moduleId !== game) return false;
            const at = new Date(e.playedAt).getTime();
            if (fromMs !== null && at < fromMs) return false;
            if (toMs !== null && at >= toMs) return false;
            return true;
        });
    }, [entries, game, from, to]);

    const hasFilters = game !== "all" || from !== "" || to !== "";

    function reset() {
        setGame("all");
        setFrom("");
        setTo("");
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString(
            locale === "fr" ? "fr-FR" : "en-US",
            { day: "numeric", month: "short", year: "numeric" },
        );
    }

    const fieldStyle = {
        background: "rgba(0,0,0,0.3)",
        border: "2px solid #3d2d18",
        color: "#faf2e2",
    } as const;

    return (
        <div className="flex flex-col gap-5">
            {/* ── Filters ─────────────────────────────────────────────── */}
            <div
                className="rounded-xl p-4 xl:p-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
                style={{ background: "#1c1510", border: "2px solid #3d2d18" }}
            >
                <label className="flex flex-col gap-1.5 flex-1 min-w-35">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("filter_game")}
                    </span>
                    <select
                        value={game}
                        onChange={(e) => setGame(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    >
                        <option value="all">{t("all_games")}</option>
                        {games.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1.5 flex-1 min-w-35">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("filter_from")}
                    </span>
                    <input
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => setFrom(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    />
                </label>

                <label className="flex flex-col gap-1.5 flex-1 min-w-35">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("filter_to")}
                    </span>
                    <input
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => setTo(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    />
                </label>

                {hasFilters && (
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-lg px-4 py-2.5 font-bold text-sm transition-transform active:scale-95"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "2px solid #3d2d18",
                            color: "#9a8870",
                        }}
                    >
                        {t("reset_filters")}
                    </button>
                )}
            </div>

            {/* ── List ────────────────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <p
                    className="text-sm font-semibold rounded-xl px-4 py-10 text-center"
                    style={{
                        color: "#7a6a50",
                        background: "#1c1510",
                        border: "2px dashed #3d2d18",
                    }}
                >
                    {hasFilters ? t("empty_filtered") : t("empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {filtered.map((entry) => {
                        const rs = RESULT_STYLE[entry.result];
                        const opponents = entry.players.filter((p) => !p.isYou);
                        return (
                            <li
                                key={entry.gameId}
                                className="rounded-xl p-4 xl:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                style={{
                                    background: "#1c1510",
                                    border: "2px solid #3d2d18",
                                }}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <span
                                        className="inline-flex shrink-0 items-center px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                                        style={{
                                            background: rs.bg,
                                            border: `2px solid ${rs.border}`,
                                            color: rs.fg,
                                        }}
                                    >
                                        {t(`result_${entry.result}`)}
                                    </span>
                                    <div className="min-w-0">
                                        <div
                                            className="font-black truncate"
                                            style={{ color: "#faf2e2" }}
                                        >
                                            {entry.moduleName}
                                        </div>
                                        <div
                                            className="text-xs font-semibold mt-0.5 truncate"
                                            style={{ color: "#9a8870" }}
                                        >
                                            {formatDate(entry.playedAt)}
                                            {opponents.length > 0 && (
                                                <>
                                                    {" · "}
                                                    {t("vs")}{" "}
                                                    {opponents
                                                        .map((p) =>
                                                            p.isBot
                                                                ? `${p.name} (${t("bot")})`
                                                                : p.name,
                                                        )
                                                        .join(", ")}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Link
                                    href={`/replay/${entry.gameId}`}
                                    className="shrink-0 self-start sm:self-auto rounded-lg px-4 py-2 font-black text-sm text-center transition-transform active:scale-95"
                                    style={{
                                        background: "rgba(245,197,22,0.12)",
                                        border: "2px solid rgba(245,197,22,0.3)",
                                        color: "#f5c516",
                                    }}
                                >
                                    {t("replay")}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
