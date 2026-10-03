"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
// Client-safe: models/studio only has type imports from supabase.
import { MAX_ECA_GAMES_PER_OWNER } from "@/lib/models/studio";
import { CreateGamePanel } from "./CreateGamePanel";
import { StudioGameCard, type StudioGameSummary } from "./StudioGameCard";

export function StudioHub({
    games,
}: {
    readonly games: readonly StudioGameSummary[];
}) {
    const t = useTranslations("studio");
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-8">
            <CreateGamePanel
                atLimit={games.length >= MAX_ECA_GAMES_PER_OWNER}
                onError={setError}
            />

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <section className="flex flex-col gap-4">
                <h2 className="h-lg">{t("my_games")}</h2>
                {games.length === 0 ? (
                    <div className="panel-d p-6">
                        <p className="sub text-sm">{t("empty")}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {games.map((game) => (
                            <StudioGameCard
                                key={game.id}
                                game={game}
                                onError={setError}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
