"use client";

import { useTranslations } from "next-intl";
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
    const rs = RESULT_STYLE[entry.result];
    const opponents = entry.players.filter((p) => !p.isYou);

    return (
        <li className="panel p-4 xl:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
                <span
                    className="stamp shrink-0"
                    style={{ background: rs.bg, color: rs.fg }}
                >
                    {t(`result_${entry.result}`)}
                </span>
                <div className="min-w-0">
                    <div
                        className="font-display truncate"
                        style={{ color: "var(--ink)" }}
                    >
                        {entry.moduleName}
                    </div>
                    <div
                        className="text-xs font-semibold mt-0.5 truncate"
                        style={{ color: "#5a5340" }}
                    >
                        {playedAtLabel}
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

            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                {/* Pin: exempt this replay from the 15-day sweep. Hidden once expired — nothing left to preserve. */}
                {!entry.expired && (
                    <button
                        type="button"
                        onClick={onTogglePin}
                        disabled={pinBusy}
                        title={pinned ? t("unpin") : t("pin_hint")}
                        aria-pressed={pinned}
                        className="wc-btn text-sm px-3 py-2 disabled:opacity-50"
                        style={
                            pinned
                                ? {
                                      background: "var(--gold)",
                                      color: "var(--ink)",
                                  }
                                : {
                                      background: "var(--cream2)",
                                      color: "var(--ink)",
                                  }
                        }
                    >
                        {pinned ? `📌 ${t("pinned")}` : `📌 ${t("pin")}`}
                    </button>
                )}

                {entry.expired ? (
                    <span
                        aria-disabled="true"
                        title={t("replay_expired_hint")}
                        className="rounded-wc-btn px-4 py-2 font-display text-sm text-center cursor-not-allowed opacity-50"
                        style={{
                            background: "var(--cream2)",
                            border: "2.5px solid var(--ink)",
                            color: "#5a5340",
                        }}
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
