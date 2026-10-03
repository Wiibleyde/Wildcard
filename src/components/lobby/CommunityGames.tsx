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

/** Studio games published by players, listed like open tables. */
export function CommunityGames({ games, busy, busyModuleId, onHost }: Props) {
    const t = useTranslations("lobby");

    return (
        <section className="panel flex flex-col gap-4 p-5">
            <header className="flex flex-col gap-1">
                <h2 className="h-lg">{t("community_title")}</h2>
                <p className="sub text-sm">{t("community_subtitle")}</p>
            </header>

            {games.length === 0 ? (
                <p className="well px-4 py-6 text-center text-sm font-semibold text-wc-muted">
                    {t("community_empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {games.map((g) => (
                        <li
                            key={g.id}
                            className="well grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 p-2.5 pr-3"
                        >
                            <span className="relative grid aspect-square place-items-center overflow-hidden rounded-[10px] bg-wc-panel-d font-display text-2xl text-wc-gold">
                                {g.imageUrl ? (
                                    <Image
                                        src={g.imageUrl}
                                        alt=""
                                        fill
                                        sizes="48px"
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <span aria-hidden="true">♦</span>
                                )}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate font-extrabold">
                                    {g.name}
                                </p>
                                <p className="truncate text-xs font-semibold text-wc-muted">
                                    {[
                                        g.ownerName &&
                                            t("community_by", {
                                                name: g.ownerName,
                                            }),
                                        t("community_players", {
                                            min: g.minPlayers,
                                            max: g.maxPlayers,
                                        }),
                                        t("community_rules", {
                                            n: g.ruleCount,
                                        }),
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            </div>
                            <GameButton
                                variant="green"
                                size="sm"
                                onClick={() => onHost(g.moduleId)}
                                disabled={busy}
                            >
                                {busyModuleId === g.moduleId
                                    ? t("creating")
                                    : t("host")}
                            </GameButton>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
