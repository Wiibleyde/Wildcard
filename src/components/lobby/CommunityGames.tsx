"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import { useRoomAction } from "@/hooks/lobby/useRoomAction";
import type { PublishedEcaGame } from "@/lib/models/studio";

/**
 * Community browse hub — the published games every player can host. Each card
 * hosts a private room for its `eca:<uuid>` module through the SAME
 * {@link useRoomAction} path native games use, then drops the host into the
 * lobby to invite friends or add bots. Purely presentational otherwise; the
 * server re-validates and gates the launch.
 */

interface Props {
    readonly games: readonly PublishedEcaGame[];
}

export function CommunityGames({ games }: Props) {
    const t = useTranslations("lobby");
    const { busy, error, createRoom } = useRoomAction();

    return (
        <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl xl:text-3xl text-wc-cream">
                    {t("community_title")}
                </h2>
                <p className="sub text-sm">{t("community_subtitle")}</p>
            </header>

            {error && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                        background: "var(--red)",
                        border: "2.5px solid var(--ink)",
                        boxShadow: "0 4px 0 var(--ink)",
                        color: "var(--accent-ink)",
                    }}
                >
                    {error}
                </p>
            )}

            {games.length === 0 ? (
                <div className="panel-d p-6">
                    <p className="sub text-sm">{t("community_empty")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {games.map((g) => (
                        <article
                            key={g.id}
                            className="panel lift flex flex-col gap-3 p-4 sm:p-5"
                        >
                            {g.imageUrl && (
                                <div
                                    className="relative aspect-video w-full overflow-hidden rounded-xl"
                                    style={{ border: "2.5px solid var(--ink)" }}
                                >
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
                                <h3
                                    className="font-display text-lg leading-tight"
                                    style={{ color: "var(--ink)" }}
                                >
                                    {g.name}
                                </h3>
                                <span
                                    className="stamp shrink-0"
                                    style={{
                                        background: "var(--cream2)",
                                        color: "var(--ink)",
                                    }}
                                >
                                    👥 {g.minPlayers}–{g.maxPlayers}
                                </span>
                            </div>
                            <p
                                className="text-xs font-semibold"
                                style={{ color: "#5a5340" }}
                            >
                                {t("community_by", { name: g.ownerName })}
                            </p>
                            {g.description && (
                                <p
                                    className="line-clamp-2 text-xs font-semibold"
                                    style={{ color: "#5a5340" }}
                                >
                                    {g.description}
                                </p>
                            )}
                            <p
                                className="text-xs font-semibold"
                                style={{ color: "#5a5340" }}
                            >
                                {t("community_rules", { n: g.ruleCount })}
                            </p>
                            <GameButton
                                variant="green"
                                size="sm"
                                onClick={() =>
                                    createRoom(g.moduleId, "private")
                                }
                                disabled={busy !== null}
                                className="mt-auto w-full"
                            >
                                {busy === "create" ? t("creating") : t("host")}
                            </GameButton>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
