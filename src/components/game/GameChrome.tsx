"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
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
    titleOf,
}: {
    outcome: GameOutcome | null;
    players: readonly GamePlayer[];
    currentUserId: string;
    /** Game-specific rank title (Président, Vice-Président…); `null` ⇒ none. */
    titleOf?: (rank: number, total: number) => string | null;
}) {
    const t = useTranslations("game");
    const won = outcome?.winners.includes(currentUserId) ?? false;
    const total = outcome?.rankings.length ?? 0;

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
                {/* No outcome ⇒ the game was force-ended by an admin (no winner). */}
                {!outcome
                    ? t("game_aborted")
                    : won
                      ? t("you_win")
                      : t("winner", {
                            name: nameOf(players, outcome.winners[0] ?? null),
                        })}
            </h2>

            {outcome && outcome.rankings.length > 0 && (
                <ol className="flex w-full max-w-xs flex-col gap-1.5">
                    {outcome.rankings.map((r) => {
                        const title = titleOf?.(r.rank, total) ?? null;
                        const isMe = r.playerId === currentUserId;
                        return (
                            <li
                                key={r.playerId}
                                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                                style={{
                                    background: isMe
                                        ? "rgba(245,197,22,0.12)"
                                        : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${
                                        isMe ? "#f5c51640" : "#3d2d18"
                                    }`,
                                }}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="font-black tabular-nums"
                                        style={{ color: "#7a6a50" }}
                                    >
                                        {r.rank}
                                    </span>
                                    <span
                                        className="truncate text-sm font-bold"
                                        style={{ color: "#faf2e2" }}
                                    >
                                        {nameOf(players, r.playerId)}
                                    </span>
                                </span>
                                {title ? (
                                    <span
                                        className="shrink-0 text-xs font-black uppercase tracking-wider"
                                        style={{ color: "#f5c516" }}
                                    >
                                        {title}
                                    </span>
                                ) : typeof r.score === "number" ? (
                                    <span
                                        className="shrink-0 text-sm font-bold"
                                        style={{ color: "#9a8870" }}
                                    >
                                        · {r.score}
                                    </span>
                                ) : null}
                            </li>
                        );
                    })}
                </ol>
            )}

            <GameButton href="/lobby" className="mt-2">
                {t("back_to_lobby")}
            </GameButton>
        </div>
    );
}
