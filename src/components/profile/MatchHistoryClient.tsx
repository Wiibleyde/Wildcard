"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/base/input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { fieldClass, fieldLabelClass } from "@/components/ui/fields";
import { GameButton } from "@/components/ui/GameButton";
import { SelectField } from "@/components/ui/SelectField";
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
                    <SelectField
                        id="history-game"
                        value={filter.game}
                        onChange={filter.setGame}
                        className={fieldClass}
                        options={[
                            { value: "all", label: t("all_games") },
                            ...filter.games.map((g) => ({
                                value: g.id,
                                label: g.name,
                            })),
                        ]}
                    />
                </FilterField>

                <FilterField id="history-from" label={t("filter_from")}>
                    <Input
                        id="history-from"
                        type="date"
                        value={filter.from}
                        max={filter.to || undefined}
                        onChange={(e) => filter.setFrom(e.target.value)}
                        className={fieldClass}
                    />
                </FilterField>

                <FilterField id="history-to" label={t("filter_to")}>
                    <Input
                        id="history-to"
                        type="date"
                        value={filter.to}
                        min={filter.from || undefined}
                        onChange={(e) => filter.setTo(e.target.value)}
                        className={fieldClass}
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
                <p className="panel flat px-4 py-10 text-center text-sm font-semibold text-wc-muted">
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
