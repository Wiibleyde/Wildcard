"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import { BOARD_RADIUS } from "@/lib/board/styles";
import type { GameOutcome } from "@/lib/engine/types";
import type { GameEndInfo } from "@/lib/models/gameEnd";
import { GameOverXp } from "./GameOverXp";

type GameT = ReturnType<typeof useTranslations<"game">>;

export function TurnBanner({
    label,
    highlight,
}: {
    label: string;
    highlight: boolean;
}) {
    return (
        <div
            className={`self-center rounded-wc-btn px-5 py-2.5 text-center font-display text-lg leading-none ${
                highlight
                    ? "bg-wc-orange text-white text-shadow shadow-[0_4px_0_var(--orange-d)]"
                    : "border-nb border-wc-edge bg-wc-panel-d text-wc-muted shadow-[0_4px_0_var(--drop)]"
            }`}
        >
            {label}
        </div>
    );
}

// `end` decides first: an out-of-band end never reaches a terminal state, so
// the outcome alone can't tell a forfeit from an admin abort.
function gameOverTitle(
    t: GameT,
    outcome: GameOutcome | null,
    end: GameEndInfo | null,
    nameOf: (userId: string | null) => string,
    currentUserId: string,
    won: boolean,
): string {
    if (end?.reason === "forfeit") {
        if (end.forfeitedBy === currentUserId) return t("you_forfeited");
        const name = nameOf(end.forfeitedBy);
        return won ? t("forfeit_win", { name }) : t("forfeit_by", { name });
    }
    if (end?.reason === "abandoned") return t("game_abandoned");
    if (!outcome || end?.reason === "admin") return t("game_aborted");
    if (outcome.winners.length === 0) return t("game_no_winner");
    if (won) return t("you_win");
    return t("winner", {
        name: nameOf(outcome.winners[0] ?? null),
    });
}

export function GameOverOverlay({
    outcome,
    end,
    nameOf,
    currentUserId,
    titleOf,
}: {
    outcome: GameOutcome | null;
    /** `null` on a replay frame: no settlement shown. */
    end: GameEndInfo | null;
    nameOf: (userId: string | null) => string;
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
                background: "rgba(23,17,31,0.88)",
                borderRadius: BOARD_RADIUS,
            }}
        >
            <span className="stamp bg-wc-red text-white">
                ★ {t("game_over")}
            </span>
            <h2
                className="font-display text-4xl text-shadow xl:text-5xl"
                style={{ color: won ? "var(--green)" : "var(--gold)" }}
            >
                {gameOverTitle(t, outcome, end, nameOf, currentUserId, won)}
            </h2>

            {outcome && outcome.rankings.length > 0 && (
                <ol className="flex w-full max-w-xs flex-col gap-2">
                    {outcome.rankings.map((r) => {
                        const title = titleOf?.(r.rank, total) ?? null;
                        const isMe = r.playerId === currentUserId;
                        return (
                            <li
                                key={r.playerId}
                                className={`flex items-center justify-between gap-3 rounded-[10px] px-3 py-2 ${
                                    isMe
                                        ? "bg-wc-panel-d shadow-[inset_0_0_0_2px_var(--gold)]"
                                        : "bg-wc-panel-d2"
                                }`}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="font-display tabular-nums"
                                        style={{
                                            color: isMe
                                                ? "var(--gold)"
                                                : "var(--muted)",
                                        }}
                                    >
                                        {r.rank}
                                    </span>
                                    <span className="truncate text-base font-extrabold">
                                        {nameOf(r.playerId)}
                                    </span>
                                </span>
                                {title ? (
                                    <span className="stamp shrink-0 bg-wc-gold text-wc-ink">
                                        {title}
                                    </span>
                                ) : typeof r.score === "number" ? (
                                    <span
                                        className="shrink-0 font-display text-base"
                                        style={{ color: "var(--muted)" }}
                                    >
                                        {r.score}
                                    </span>
                                ) : null}
                            </li>
                        );
                    })}
                </ol>
            )}

            {end?.xpGained ? (
                <GameOverXp userId={currentUserId} gained={end.xpGained} />
            ) : null}

            <GameButton href="/lobby" variant="orange" className="mt-2">
                {t("back_to_lobby")}
            </GameButton>
        </div>
    );
}
