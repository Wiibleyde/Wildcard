"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";
import { PanelHeader } from "./PanelHeader";

export interface AdminEcaGameView {
    readonly id: string;
    readonly ownerName: string | null;
    readonly name: string;
    readonly description: string | null;
    readonly status: "draft" | "published";
    /** Public URL, already resolved from the storage path. */
    readonly imageUrl: string | null;
    /** Taken down by an admin: the owner can't re-publish until an admin restores it. */
    readonly moderationLocked: boolean;
    readonly updatedAt: string;
}

interface Props {
    readonly games: readonly AdminEcaGameView[];
    /** Admins only; moderators get a read-only view. */
    readonly canManage: boolean;
}

export function EcaGamesAdminPanel({ games, canManage }: Props) {
    const t = useTranslations("admin");
    const tCommon = useTranslations("common");
    const format = useFormatter();
    const router = useRouter();
    const confirm = useConfirm();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function runAction(gameId: string, init: RequestInit) {
        setBusyId(gameId);
        setError(null);
        try {
            const res = await apiFetch(`/api/admin/eca/${gameId}`, init);
            if (!res.ok) {
                setError(tCommon("error"));
                return;
            }
            router.refresh();
        } catch {
            setError(tCommon("error"));
        } finally {
            setBusyId(null);
        }
    }

    function toggleStatus(game: AdminEcaGameView) {
        if (busyId) return;
        return runAction(game.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: game.status === "published" ? "draft" : "published",
            }),
        });
    }

    async function remove(game: AdminEcaGameView) {
        const ok = await confirm({
            title: t("eca_delete"),
            message: t("eca_delete_confirm", { name: game.name }),
            confirmLabel: t("eca_delete"),
            variant: "red",
        });
        if (ok) await runAction(game.id, { method: "DELETE" });
    }

    return (
        <section className="panel-d flex flex-col gap-4 p-5 xl:p-6">
            <PanelHeader
                badge={t("eca_count", { n: games.length })}
                accent="var(--gold)"
                onRefresh={() => router.refresh()}
            />

            {error && <ErrorBanner>{error}</ErrorBanner>}

            {games.length === 0 ? (
                <p className="py-8 text-center text-sm font-semibold text-wc-muted">
                    {t("eca_none")}
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {games.map((game) => (
                        <li
                            key={game.id}
                            className="well flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                        >
                            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-wc-panel-d sm:w-32">
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
                                        aria-hidden="true"
                                        className="flex h-full w-full items-center justify-center text-2xl text-wc-muted opacity-50"
                                    >
                                        ♠
                                    </div>
                                )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-display text-base leading-tight">
                                        {game.name}
                                    </span>
                                    <span
                                        className="stamp shrink-0"
                                        style={{
                                            background:
                                                game.status === "published"
                                                    ? "var(--green)"
                                                    : "var(--panel-d)",
                                            color:
                                                game.status === "published"
                                                    ? "#fff"
                                                    : "var(--muted)",
                                        }}
                                    >
                                        {game.status === "published"
                                            ? t("eca_status_published")
                                            : t("eca_status_draft")}
                                    </span>
                                    {game.moderationLocked && (
                                        <span
                                            className="stamp shrink-0"
                                            style={{
                                                background: "var(--red)",
                                                color: "var(--cream)",
                                            }}
                                        >
                                            {t("eca_locked")}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-semibold text-wc-muted">
                                    {t("eca_meta", {
                                        name:
                                            game.ownerName ??
                                            t("eca_owner_unknown"),
                                        date: format.dateTime(
                                            new Date(game.updatedAt),
                                            "short",
                                            { timeZone: "UTC" },
                                        ),
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
                                            : game.moderationLocked
                                              ? t("eca_restore")
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
