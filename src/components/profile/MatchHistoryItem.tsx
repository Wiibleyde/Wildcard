"use client";

import { useFormatter, useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { MatchHistoryEntry, MatchResult } from "@/lib/models/history";

const RESULT_STYLE: Record<MatchResult, { bg: string; fg: string }> = {
    win: { bg: "var(--green)", fg: "var(--ink)" },
    loss: { bg: "var(--red)", fg: "var(--accent-ink)" },
    none: { bg: "var(--cream2)", fg: "var(--ink)" },
};

type Props = {
    entry: MatchHistoryEntry;
    playedAtLabel: string;
    pinned: boolean;
    pinBusy: boolean;
    onTogglePin: () => void;
};

export function MatchHistoryItem({
    entry,
    playedAtLabel,
    pinned,
    pinBusy,
    onTogglePin,
}: Props) {
    const t = useTranslations("history");
    const format = useFormatter();
    const rs = RESULT_STYLE[entry.result];
    const opponents = format.list(
        entry.players
            .filter((p) => !p.isYou)
            .map((p) => (p.isBot ? t("bot_name", { name: p.name }) : p.name)),
        { type: "unit" },
    );

    return (
        <li className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between xl:p-5">
            <div className="flex min-w-0 items-center gap-4">
                <span
                    className="stamp shrink-0"
                    style={{ background: rs.bg, color: rs.fg }}
                >
                    {t(`result_${entry.result}`)}
                </span>
                <div className="min-w-0">
                    <div className="truncate font-display text-wc-ink">
                        {entry.moduleName}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-semibold text-wc-ink-soft">
                        {opponents
                            ? t("played_vs", {
                                  date: playedAtLabel,
                                  opponents,
                              })
                            : playedAtLabel}
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                {/* Pinning exempts the replay from the 15-day sweep: pointless once expired. */}
                {!entry.expired && (
                    <button
                        type="button"
                        onClick={onTogglePin}
                        disabled={pinBusy}
                        title={pinned ? t("unpin") : t("pin_hint")}
                        aria-pressed={pinned}
                        className="wc-btn px-3 py-2 text-sm text-wc-ink disabled:opacity-50"
                        style={{
                            background: pinned
                                ? "var(--gold)"
                                : "var(--cream2)",
                        }}
                    >
                        <span aria-hidden="true">📌</span>
                        {pinned ? t("pinned") : t("pin")}
                    </button>
                )}

                {entry.expired ? (
                    <span
                        aria-disabled="true"
                        title={t("replay_expired_hint")}
                        className="cursor-not-allowed rounded-wc-btn border-nb border-wc-ink bg-wc-cream2 px-4 py-2 text-center font-display text-sm text-wc-ink-soft opacity-50"
                    >
                        {t("replay_expired")}
                    </span>
                ) : (
                    <GameButton
                        href={`/replay/${entry.gameId}`}
                        variant="gold"
                        size="sm"
                    >
                        {t("replay")}
                    </GameButton>
                )}
            </div>
        </li>
    );
}
