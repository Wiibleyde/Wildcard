"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { GameOutcome } from "@/lib/engine/types";
import type { GamePlayer } from "@/lib/models/game";
import type { GameEndInfo } from "@/lib/models/gameEnd";
import { GameOverXp } from "./GameOverXp";

export function nameOf(
    players: readonly GamePlayer[],
    userId: string | null,
): string {
    if (!userId) return "?";
    return players.find((p) => p.userId === userId)?.username ?? "?";
}

export function TurnBanner({
    label,
    highlight,
}: {
    label: string;
    highlight: boolean;
}) {
    return (
        <div
            className="self-center rounded-wc-btn border-nb px-5 py-2 text-center font-display text-lg leading-none"
            style={
                highlight
                    ? {
                          background: "var(--gold)",
                          color: "var(--ink)",
                          borderColor: "var(--ink)",
                          boxShadow: "0 4px 0 var(--ink)",
                      }
                    : {
                          background: "var(--panel-d)",
                          color: "var(--muted)",
                          borderColor: "var(--ink)",
                          boxShadow: "0 4px 0 var(--ink)",
                      }
            }
        >
            {label}
        </div>
    );
}

/**
 * Headline of the game-over overlay. `end` (persisted end reason) decides
 * first — an out-of-band end never reaches a terminal state, so the outcome
 * alone cannot tell a forfeit from an admin abort; `end === null` (a replay
 * frame) falls back to the outcome.
 */
function gameOverTitle(
    t: ReturnType<typeof useTranslations<"game">>,
    outcome: GameOutcome | null,
    end: GameEndInfo | null,
    players: readonly GamePlayer[],
    currentUserId: string,
    won: boolean,
): string {
    if (end?.reason === "forfeit") {
        if (end.forfeitedBy === currentUserId) return t("you_forfeited");
        const name = nameOf(players, end.forfeitedBy);
        return won ? t("forfeit_win", { name }) : t("forfeit_by", { name });
    }
    if (end?.reason === "abandoned") return t("game_abandoned");
    // No outcome ⇒ force-ended by an admin (or a legacy out-of-band end).
    if (!outcome || end?.reason === "admin") return t("game_aborted");
    // A finished game without a winner (a resigned solo game).
    if (outcome.winners.length === 0) return t("game_no_winner");
    if (won) return t("you_win");
    return t("winner", { name: nameOf(players, outcome.winners[0] ?? null) });
}

export function GameOverOverlay({
    outcome,
    end,
    players,
    currentUserId,
    titleOf,
}: {
    outcome: GameOutcome | null;
    /** How the game ended; `null` on a replay frame (no settlement shown). */
    end: GameEndInfo | null;
    players: readonly GamePlayer[];
    currentUserId: string;
    titleOf?: (rank: number, total: number) => string | null;
}) {
    const t = useTranslations("game");
    const won = outcome?.winners.includes(currentUserId) ?? false;
    const total = outcome?.rankings.length ?? 0;

    return (
        <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 px-6 text-center backdrop-blur-sm"
            style={{
                background: "rgba(10,26,46,0.86)",
                borderRadius: "clamp(1.125rem, 3vw, 2rem)",
            }}
        >
            <span
                className="stamp"
                style={{ background: "var(--cream)", color: "var(--red)" }}
            >
                ★ {t("game_over")}
            </span>
            <h2
                className="font-display text-4xl xl:text-5xl"
                style={{ color: won ? "var(--green)" : "var(--gold)" }}
            >
                {gameOverTitle(t, outcome, end, players, currentUserId, won)}
            </h2>

            {outcome && outcome.rankings.length > 0 && (
                <ol className="flex w-full max-w-xs flex-col gap-2">
                    {outcome.rankings.map((r) => {
                        const title = titleOf?.(r.rank, total) ?? null;
                        const isMe = r.playerId === currentUserId;
                        return (
                            <li
                                key={r.playerId}
                                className="flex items-center justify-between gap-3 rounded-lg border-nb px-3 py-2"
                                style={{
                                    background: isMe
                                        ? "var(--cream)"
                                        : "var(--cream2)",
                                    borderColor: "var(--ink)",
                                    boxShadow: "0 3px 0 var(--ink)",
                                }}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="font-display tabular-nums"
                                        style={{
                                            color: isMe
                                                ? "var(--red)"
                                                : "#8a7d55",
                                        }}
                                    >
                                        {r.rank}
                                    </span>
                                    <span
                                        className="truncate font-display text-base"
                                        style={{ color: "var(--ink)" }}
                                    >
                                        {nameOf(players, r.playerId)}
                                    </span>
                                </span>
                                {title ? (
                                    <span
                                        className="stamp shrink-0"
                                        style={{
                                            background: "var(--gold)",
                                            color: "var(--ink)",
                                        }}
                                    >
                                        {title}
                                    </span>
                                ) : typeof r.score === "number" ? (
                                    <span
                                        className="shrink-0 font-display text-base"
                                        style={{ color: "#5a5340" }}
                                    >
                                        {r.score}
                                    </span>
                                ) : null}
                            </li>
                        );
                    })}
                </ol>
            )}

            {/* XP reward — the amount the server settled for this viewer
                (none for spectators, the forfeiter, admin/reaper closes, or an
                unplayed / winnerless game). */}
            {end?.xpGained ? (
                <GameOverXp userId={currentUserId} gained={end.xpGained} />
            ) : null}

            <GameButton href="/lobby" className="mt-2">
                {t("back_to_lobby")}
            </GameButton>
        </div>
    );
}
