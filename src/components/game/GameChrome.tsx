"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GameOutcome } from "@/lib/engine/types";
import type { GamePlayer } from "@/lib/models/game";

/** Resolve a player's display name from the seat list, falling back to id. */
export function nameOf(
    players: readonly GamePlayer[],
    userId: string | null,
): string {
    if (!userId) return "?";
    return players.find((p) => p.userId === userId)?.username ?? "?";
}

/** Banner above the board: whose turn it is, or a spectator notice. */
export function TurnBanner({
    label,
    highlight,
}: {
    label: string;
    highlight: boolean;
}) {
    return (
        <div
            className="rounded-xl px-4 py-2 text-center text-sm font-black"
            style={{
                background: highlight
                    ? "rgba(245,197,22,0.15)"
                    : "rgba(255,255,255,0.04)",
                color: highlight ? "#f5c516" : "#9a8870",
                border: `1px solid ${highlight ? "#f5c51640" : "#3d2d18"}`,
            }}
        >
            {label}
        </div>
    );
}

/** Full-board overlay shown once `isOver`, with final standings. */
export function GameOverOverlay({
    outcome,
    players,
    currentUserId,
}: {
    outcome: GameOutcome | null;
    players: readonly GamePlayer[];
    currentUserId: string;
}) {
    const t = useTranslations("game");
    const won = outcome?.winners.includes(currentUserId) ?? false;

    return (
        <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-2xl px-6 text-center backdrop-blur-sm"
            style={{ background: "rgba(13,10,5,0.82)" }}
        >
            <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "#7a6a50" }}
            >
                {t("game_over")}
            </span>
            <h2
                className="text-4xl xl:text-5xl font-black"
                style={{ color: won ? "#48c97a" : "#f5c516" }}
            >
                {won
                    ? t("you_win")
                    : t("winner", {
                          name: nameOf(players, outcome?.winners[0] ?? null),
                      })}
            </h2>

            {outcome && outcome.rankings.length > 0 && (
                <ol className="flex flex-col gap-1">
                    {outcome.rankings.map((r) => (
                        <li
                            key={r.playerId}
                            className="text-sm font-bold"
                            style={{ color: "#faf2e2" }}
                        >
                            {r.rank}. {nameOf(players, r.playerId)}
                            {typeof r.score === "number" ? ` · ${r.score}` : ""}
                        </li>
                    ))}
                </ol>
            )}

            <Link
                href="/lobby"
                className="mt-2 rounded-xl px-6 py-3 font-black text-sm"
                style={{
                    background: "#f5c516",
                    color: "#0d0a05",
                    boxShadow: "0 4px 0 0 #7a5a00",
                }}
            >
                {t("back_to_lobby")}
            </Link>
        </div>
    );
}
