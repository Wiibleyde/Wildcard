"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { usePollingWithClock } from "@/hooks/usePollingWithClock";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";
import type { OngoingGame } from "@/lib/models/admin";
import { GameRow } from "./GameRow";
import { PanelHeader } from "./PanelHeader";

const REFRESH_MS = 10_000;

type Props = {
    games: OngoingGame[];
    /** Admins only; moderators get a read-only list. */
    canEnd: boolean;
};

export function OngoingGamesPanel({ games, canEnd }: Props) {
    const t = useTranslations("admin");
    const router = useRouter();
    const confirm = useConfirm();
    const { now, refreshing, refreshNow } = usePollingWithClock({
        refreshMs: REFRESH_MS,
    });
    const [endingId, setEndingId] = useState<string | null>(null);
    const [endError, setEndError] = useState<string | null>(null);

    async function endGame(game: OngoingGame) {
        const ok = await confirm({
            title: t("end_title"),
            message: t("end_confirm", { game: game.moduleName }),
            confirmLabel: t("end_game"),
            variant: "red",
        });
        if (!ok) return;

        setEndingId(game.gameId);
        setEndError(null);
        try {
            const res = await apiFetch(`/api/admin/games/${game.gameId}/end`, {
                method: "POST",
            });
            if (!res.ok) {
                setEndError(t("end_error", { game: game.moduleName }));
                return;
            }
            router.refresh();
        } catch {
            setEndError(t("end_error", { game: game.moduleName }));
        } finally {
            setEndingId(null);
        }
    }

    return (
        <section className="panel-d flex flex-col gap-4 p-5 xl:p-6">
            <PanelHeader
                title={t("ongoing_title")}
                badge={String(games.length)}
                accent="var(--green)"
                onRefresh={refreshNow}
                refreshing={refreshing}
            />

            {endError && <ErrorBanner>{endError}</ErrorBanner>}

            {games.length === 0 ? (
                <p className="py-8 text-center text-sm font-semibold text-wc-muted">
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
