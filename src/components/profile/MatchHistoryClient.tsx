"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
    fieldClass,
    fieldLabelClass,
    fieldStyle,
} from "@/components/ui/fields";
import { GameButton } from "@/components/ui/GameButton";
import { useFilteredHistory } from "@/hooks/profile/useFilteredHistory";
import { useGamePinning } from "@/hooks/profile/useGamePinning";
import { useHydrated } from "@/hooks/useHydrated";
import type { MatchHistoryEntry } from "@/lib/models/history";
import { MAX_PERSISTENT_REPLAYS } from "@/lib/models/persistence";
import { MatchHistoryItem } from "./MatchHistoryItem";

function FilterField({
    id,
    label,
    children,
}: {
    id: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-35 flex-1 flex-col gap-1.5">
            <label htmlFor={id} className={fieldLabelClass}>
                {label}
            </label>
            {children}
        </div>
    );
}

export function MatchHistoryClient({
    entries,
}: {
    entries: readonly MatchHistoryEntry[];
}) {
    const t = useTranslations("history");
    const format = useFormatter();
    const filter = useFilteredHistory(entries);
    const pinning = useGamePinning(entries);

    // SSR and hydration render in UTC (identical on both sides); once mounted,
    // the viewer's zone, so dates agree with the local-day from/to filters.
    const hydrated = useHydrated();
    const timeZone = hydrated
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";

    return (
        <div className="flex flex-col gap-5">
            <div className="panel-d flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end xl:p-5">
                <FilterField id="history-game" label={t("filter_game")}>
                    <select
                        id="history-game"
                        value={filter.game}
                        onChange={(e) => filter.setGame(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                    >
                        <option value="all">{t("all_games")}</option>
                        {filter.games.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                </FilterField>

                <FilterField id="history-from" label={t("filter_from")}>
                    <input
                        id="history-from"
                        type="date"
                        value={filter.from}
                        max={filter.to || undefined}
                        onChange={(e) => filter.setFrom(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                    />
                </FilterField>

                <FilterField id="history-to" label={t("filter_to")}>
                    <input
                        id="history-to"
                        type="date"
                        value={filter.to}
                        min={filter.from || undefined}
                        onChange={(e) => filter.setTo(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                    />
                </FilterField>

                {filter.hasFilters && (
                    <GameButton
                        variant="ghost"
                        size="sm"
                        onClick={filter.reset}
                    >
                        {t("reset_filters")}
                    </GameButton>
                )}
            </div>

            <span
                className="stamp w-fit"
                style={{ background: "var(--panel-d)", color: "var(--cream)" }}
            >
                <span aria-hidden="true">📌</span>
                {t("pin_count", {
                    n: pinning.pinnedCount,
                    max: MAX_PERSISTENT_REPLAYS,
                })}
            </span>

            {pinning.error && <ErrorBanner>{pinning.error}</ErrorBanner>}

            {filter.filtered.length === 0 ? (
                <p className="panel flat px-4 py-10 text-center text-sm font-semibold text-wc-ink-soft">
                    {filter.hasFilters ? t("empty_filtered") : t("empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {filter.filtered.map((entry) => (
                        <MatchHistoryItem
                            key={entry.gameId}
                            entry={entry}
                            playedAtLabel={format.dateTime(
                                new Date(entry.playedAt),
                                "short",
                                { timeZone },
                            )}
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
