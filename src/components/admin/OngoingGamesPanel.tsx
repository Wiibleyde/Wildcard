"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { usePollingWithClock } from "@/hooks/usePollingWithClock";
import type { OngoingGame } from "@/lib/models/admin";
import { GameRow } from "./GameRow";

const REFRESH_MS = 10_000;

type Props = {
    games: OngoingGame[];
    /** Only admins may force-end a game; moderators see a read-only list. */
    canEnd: boolean;
};

/**
 * Moderator view of every live game. Keeps the server-rendered list fresh by
 * polling `router.refresh()` and ticks a clock for relative "started" times.
 */
export function OngoingGamesPanel({ games, canEnd }: Props) {
    const t = useTranslations("admin");
    const router = useRouter();
    const confirm = useConfirm();
    const { now, refreshing, refreshNow } = usePollingWithClock({
        refreshMs: REFRESH_MS,
    });
    const [endingId, setEndingId] = useState<string | null>(null);

    // Server re-checks the admin role and bumps the game version, so every open
    // client refetches and lands on the game-over screen.
    async function endGame(game: OngoingGame) {
        const ok = await confirm({
            title: t("end_title"),
            message: t("end_confirm", { game: game.moduleName }),
            confirmLabel: t("end_game"),
            variant: "red",
        });
        if (!ok) return;

        setEndingId(game.gameId);
        try {
            await fetch(`/api/admin/games/${game.gameId}/end`, {
                method: "POST",
            });
            router.refresh();
        } finally {
            setEndingId(null);
        }
    }

    return (
        <section className="panel-d p-5 xl:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-xl xl:text-2xl leading-none">
                        {t("ongoing_title")}
                    </h2>
                    <span
                        className="stamp"
                        style={{
                            background: "var(--green)",
                            color: "var(--ink)",
                        }}
                    >
                        {games.length}
                    </span>
                </div>
                <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={refreshNow}
                    disabled={refreshing}
                >
                    {t("refresh")}
                </GameButton>
            </div>

            {games.length === 0 ? (
                <p
                    className="text-sm font-semibold py-8 text-center"
                    style={{ color: "var(--muted)" }}
                >
                    {t("no_games")}
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {games.map((g) => (
                        <GameRow
                            key={g.gameId}
                            game={g}
                            canEnd={canEnd}
                            now={now}
                            endingId={endingId}
                            onEnd={endGame}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
