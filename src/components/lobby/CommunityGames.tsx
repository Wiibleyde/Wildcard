"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { PublishedEcaGame } from "@/lib/models/studio";

interface Props {
    readonly games: readonly PublishedEcaGame[];
    readonly busy: boolean;
    readonly busyModuleId: string | null;
    readonly onHost: (moduleId: string) => void;
}

export function CommunityGames({ games, busy, busyModuleId, onHost }: Props) {
    const t = useTranslations("lobby");

    return (
        <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl text-wc-cream xl:text-3xl">
                    {t("community_title")}
                </h2>
                <p className="sub text-sm">{t("community_subtitle")}</p>
            </header>

            {games.length === 0 ? (
                <div className="panel-d p-6">
                    <p className="sub text-sm">{t("community_empty")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {games.map((g) => (
                        <article
                            key={g.id}
                            className="panel lift flex flex-col gap-3 p-4 sm:p-5"
                        >
                            {g.imageUrl && (
                                <div className="relative aspect-video w-full overflow-hidden rounded-xl border-nb border-wc-ink">
                                    <Image
                                        src={g.imageUrl}
                                        alt={g.name}
                                        fill
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            )}
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-display text-lg leading-tight text-wc-ink">
                                    {g.name}
                                </h3>
                                <span
                                    className="stamp shrink-0"
                                    style={{
                                        background: "var(--cream2)",
                                        color: "var(--ink)",
                                    }}
                                >
                                    <span aria-hidden="true">👥</span>
                                    {t("community_players", {
                                        min: g.minPlayers,
                                        max: g.maxPlayers,
                                    })}
                                </span>
                            </div>
                            {g.ownerName && (
                                <p className="text-xs font-semibold text-wc-ink-soft">
                                    {t("community_by", { name: g.ownerName })}
                                </p>
                            )}
                            {g.description && (
                                <p className="line-clamp-2 text-xs font-semibold text-wc-ink-soft">
                                    {g.description}
                                </p>
                            )}
                            <p className="text-xs font-semibold text-wc-ink-soft">
                                {t("community_rules", { n: g.ruleCount })}
                            </p>
                            <GameButton
                                variant="green"
                                size="sm"
                                onClick={() => onHost(g.moduleId)}
                                disabled={busy}
                                className="mt-auto w-full"
                            >
                                {busyModuleId === g.moduleId
                                    ? t("creating")
                                    : t("host")}
                            </GameButton>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
