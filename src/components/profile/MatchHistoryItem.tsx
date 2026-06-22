"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { MatchHistoryEntry, MatchResult } from "@/lib/models/history";

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
        <li
            className="rounded-xl p-4 xl:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "#1c1510", border: "2px solid #3d2d18" }}
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
                        className="rounded-lg px-3 py-2 font-black text-sm transition-transform active:scale-95 disabled:opacity-50"
                        style={
                            pinned
                                ? {
                                      background: "rgba(245,197,22,0.16)",
                                      border: "2px solid rgba(245,197,22,0.5)",
                                      color: "#f5c516",
                                  }
                                : {
                                      background: "rgba(255,255,255,0.04)",
                                      border: "2px solid #3d2d18",
                                      color: "#9a8870",
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
                        className="rounded-lg px-4 py-2 font-black text-sm text-center cursor-not-allowed opacity-50"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "2px solid #3d2d18",
                            color: "#7a6a50",
                        }}
                    >
                        {t("replay_expired")}
                    </span>
                ) : (
                    <Link
                        href={`/replay/${entry.gameId}`}
                        className="rounded-lg px-4 py-2 font-black text-sm text-center transition-transform active:scale-95"
                        style={{
                            background: "rgba(245,197,22,0.12)",
                            border: "2px solid rgba(245,197,22,0.3)",
                            color: "#f5c516",
                        }}
                    >
                        {t("replay")}
                    </Link>
                )}
            </div>
        </li>
    );
}
