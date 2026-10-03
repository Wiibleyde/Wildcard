"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/base/button";
import { GameButton, gameButtonClass } from "@/components/ui/GameButton";
import type { MatchHistoryEntry, MatchResult } from "@/lib/models/history";

const RESULT_STYLE: Record<MatchResult, { bg: string; fg: string }> = {
    win: { bg: "var(--green)", fg: "#fff" },
    loss: { bg: "var(--red)", fg: "#fff" },
    none: { bg: "var(--panel-d2)", fg: "var(--muted)" },
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
    const tCommon = useTranslations("common");
    const format = useFormatter();
    const rs = RESULT_STYLE[entry.result];
    const opponents = format.list(
        entry.players
            .filter((p) => !p.isYou)
            .map((p) =>
                p.botNumber === null
                    ? p.name
                    : tCommon("computer", { n: p.botNumber }),
            ),
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
                    <div className="truncate font-display text-lg">
                        {entry.moduleName}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-semibold text-wc-muted">
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
                    <Button
                        onClick={onTogglePin}
                        disabled={pinBusy}
                        title={pinned ? t("unpin") : t("pin_hint")}
                        aria-pressed={pinned}
                        className={gameButtonClass(
                            pinned ? "gold" : "cream",
                            "sm",
                            "px-3",
                        )}
                    >
                        <span aria-hidden="true">📌</span>
                        {pinned ? t("pinned") : t("pin")}
                    </Button>
                )}

                {entry.expired ? (
                    <span
                        aria-disabled="true"
                        title={t("replay_expired_hint")}
                        className="well cursor-not-allowed px-4 py-2 text-center text-sm font-bold text-wc-sub"
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
