"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";

/** One row of the moderation table — image already resolved to a public URL. */
export interface AdminEcaGameView {
    readonly id: string;
    readonly ownerName: string | null;
    readonly name: string;
    readonly description: string | null;
    readonly status: "draft" | "published";
    readonly imageUrl: string | null;
    readonly updatedAt: string;
}

interface Props {
    readonly games: readonly AdminEcaGameView[];
    /** Only admins may unpublish / delete; moderators get a read-only view. */
    readonly canManage: boolean;
}

/**
 * Moderation table for every creator's studio games. Lists all games across
 * owners (fetched server-side on the service role) and — for admins — lets
 * them unpublish a live game or delete it outright. Owner-authored edits stay
 * in the studio; this panel is take-down only.
 */
export function EcaGamesAdminPanel({ games, canManage }: Props) {
    const t = useTranslations("admin");
    const locale = useLocale();
    const router = useRouter();
    const confirm = useConfirm();
    const [busyId, setBusyId] = useState<string | null>(null);

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(
            locale === "fr" ? "fr-FR" : "en-US",
            {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
            },
        );
    }

    async function toggleStatus(game: AdminEcaGameView) {
        if (busyId) return;
        const next = game.status === "published" ? "draft" : "published";
        setBusyId(game.id);
        try {
            await fetch(`/api/admin/eca/${game.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: next }),
            });
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    async function remove(game: AdminEcaGameView) {
        const ok = await confirm({
            title: t("eca_delete"),
            message: t("eca_delete_confirm", { name: game.name }),
            confirmLabel: t("eca_delete"),
            variant: "red",
        });
        if (!ok) return;
        setBusyId(game.id);
        try {
            await fetch(`/api/admin/eca/${game.id}`, { method: "DELETE" });
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    return (
        <section className="panel-d flex flex-col gap-4 p-5 xl:p-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-xl leading-none xl:text-2xl">
                        {t("eca_title")}
                    </h2>
                    <span
                        className="stamp"
                        style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                        }}
                    >
                        {games.length}
                    </span>
                </div>
                <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={() => router.refresh()}
                >
                    {t("refresh")}
                </GameButton>
            </div>

            {games.length === 0 ? (
                <p
                    className="py-8 text-center text-sm font-semibold"
                    style={{ color: "var(--muted)" }}
                >
                    {t("eca_none")}
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {games.map((game) => (
                        <li
                            key={game.id}
                            className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center"
                            style={{
                                background: "var(--cream)",
                                border: "2.5px solid var(--ink)",
                            }}
                        >
                            <div
                                className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl sm:w-32"
                                style={{
                                    border: "2px solid var(--ink)",
                                    background: "var(--cream2)",
                                }}
                            >
                                {game.imageUrl ? (
                                    <Image
                                        src={game.imageUrl}
                                        alt={game.name}
                                        fill
                                        sizes="128px"
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div
                                        className="flex h-full w-full items-center justify-center text-2xl"
                                        style={{ color: "#b5ac93" }}
                                    >
                                        ♠
                                    </div>
                                )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className="font-display text-base leading-tight"
                                        style={{ color: "var(--ink)" }}
                                    >
                                        {game.name}
                                    </span>
                                    <span
                                        className="stamp shrink-0"
                                        style={
                                            game.status === "published"
                                                ? {
                                                      background:
                                                          "var(--green)",
                                                      color: "var(--ink)",
                                                  }
                                                : {
                                                      background:
                                                          "var(--cream2)",
                                                      color: "var(--ink)",
                                                  }
                                        }
                                    >
                                        {game.status === "published"
                                            ? t("eca_status_published")
                                            : t("eca_status_draft")}
                                    </span>
                                </div>
                                <p
                                    className="text-xs font-semibold"
                                    style={{ color: "#5a5340" }}
                                >
                                    {t("eca_owner", {
                                        name: game.ownerName ?? "—",
                                    })}{" "}
                                    ·{" "}
                                    {t("eca_updated", {
                                        date: formatDate(game.updatedAt),
                                    })}
                                </p>
                            </div>

                            {canManage && (
                                <div className="flex shrink-0 gap-2">
                                    <GameButton
                                        variant="teal"
                                        size="sm"
                                        onClick={() => toggleStatus(game)}
                                        disabled={busyId !== null}
                                    >
                                        {game.status === "published"
                                            ? t("eca_unpublish")
                                            : t("eca_publish")}
                                    </GameButton>
                                    <GameButton
                                        variant="red"
                                        size="sm"
                                        onClick={() => remove(game)}
                                        disabled={busyId !== null}
                                    >
                                        {t("eca_delete")}
                                    </GameButton>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
