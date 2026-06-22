"use client";

import { useLocale, useTranslations } from "next-intl";
import { useFilteredHistory } from "@/hooks/useFilteredHistory";
import { useGamePinning } from "@/hooks/useGamePinning";
import type { MatchHistoryEntry } from "@/lib/models/history";
import { MAX_PERSISTENT_REPLAYS } from "@/lib/models/persistence";
import { MatchHistoryItem } from "./MatchHistoryItem";

interface Props {
    entries: readonly MatchHistoryEntry[];
}

const fieldStyle = {
    background: "rgba(0,0,0,0.3)",
    border: "2px solid #3d2d18",
    color: "#faf2e2",
} as const;

export function MatchHistoryClient({ entries }: Props) {
    const t = useTranslations("history");
    const locale = useLocale();

    const filter = useFilteredHistory(entries);
    const pinning = useGamePinning(entries);

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString(
            locale === "fr" ? "fr-FR" : "en-US",
            { day: "numeric", month: "short", year: "numeric" },
        );
    }

    return (
        <div className="flex flex-col gap-5">
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
                        value={filter.game}
                        onChange={(e) => filter.setGame(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    >
                        <option value="all">{t("all_games")}</option>
                        {filter.games.map((g) => (
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
                        value={filter.from}
                        max={filter.to || undefined}
                        onChange={(e) => filter.setFrom(e.target.value)}
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
                        value={filter.to}
                        min={filter.from || undefined}
                        onChange={(e) => filter.setTo(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    />
                </label>

                {filter.hasFilters && (
                    <button
                        type="button"
                        onClick={filter.reset}
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

            <div className="flex items-center justify-between gap-3 px-1">
                <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    📌{" "}
                    {t("pin_count", {
                        n: pinning.pinnedCount,
                        max: MAX_PERSISTENT_REPLAYS,
                    })}
                </span>
                {pinning.error && (
                    <span
                        className="text-xs font-semibold"
                        style={{ color: "#e04040" }}
                    >
                        {pinning.error}
                    </span>
                )}
            </div>

            {filter.filtered.length === 0 ? (
                <p
                    className="text-sm font-semibold rounded-xl px-4 py-10 text-center"
                    style={{
                        color: "#7a6a50",
                        background: "#1c1510",
                        border: "2px dashed #3d2d18",
                    }}
                >
                    {filter.hasFilters ? t("empty_filtered") : t("empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {filter.filtered.map((entry) => (
                        <MatchHistoryItem
                            key={entry.gameId}
                            entry={entry}
                            playedAtLabel={formatDate(entry.playedAt)}
                            pinned={pinning.isPinned(entry.gameId)}
                            pinBusy={pinning.busy === entry.gameId}
                            onTogglePin={() => pinning.togglePin(entry.gameId)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}
