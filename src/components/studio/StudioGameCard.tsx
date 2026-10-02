"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { postJson } from "@/hooks/studio/postJson";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useRouter } from "@/i18n/navigation";
import { ecaModuleIdFor } from "@/lib/eca/id";
import type { EcaGameStatus } from "@/lib/models/studio";
import { mutedTextStyle } from "./fields";
import { StatusStamp } from "./StatusStamp";

export interface StudioGameSummary {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
    readonly ruleCount: number;
    /** Display-ready public URL. */
    readonly imageUrl: string | null;
    readonly updatedAt: string;
    readonly moderationLocked: boolean;
}

export function StudioGameCard({
    game,
    onError,
}: {
    readonly game: StudioGameSummary;
    readonly onError: (message: string | null) => void;
}) {
    const t = useTranslations("studio");
    const format = useFormatter();
    const router = useRouter();
    const confirm = useConfirm();
    const [launching, setLaunching] = useState(false);
    const deleteMutation = useApiMutation<undefined>(
        `/api/studio/games/${game.id}`,
        { method: "DELETE" },
    );
    const deleting = deleteMutation.status === "pending";

    /** Owners can host their own drafts too (playtest with friends). */
    async function handlePlay() {
        if (launching) return;
        setLaunching(true);
        onError(null);
        const result = await postJson("/api/rooms", {
            moduleId: ecaModuleIdFor(game.id),
            visibility: "private",
        });
        if (result.ok && typeof result.data.code === "string") {
            router.push(`/lobby/${result.data.code}`);
            return;
        }
        setLaunching(false);
        onError(t("play_error"));
    }

    async function handleDelete() {
        const accepted = await confirm({
            title: t("delete"),
            message: t("delete_confirm", { name: game.name }),
            confirmLabel: t("delete"),
            variant: "red",
        });
        if (!accepted) return;
        onError(null);
        if (await deleteMutation.mutate(undefined)) router.refresh();
        else onError(t("delete_error"));
    }

    return (
        <article className="panel lift flex flex-col gap-3 p-4 sm:p-5">
            {game.imageUrl && (
                <div
                    className="relative aspect-video w-full overflow-hidden rounded-xl"
                    style={{ border: "2.5px solid var(--ink)" }}
                >
                    <Image
                        src={game.imageUrl}
                        alt={game.name}
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
                    {game.name}
                </h3>
                <StatusStamp status={game.status} className="shrink-0" />
            </div>
            {game.moderationLocked && (
                <StatusStamp status="locked" className="self-start" />
            )}
            {game.description && (
                <p
                    className="line-clamp-2 text-xs font-semibold"
                    style={mutedTextStyle}
                >
                    {game.description}
                </p>
            )}
            <p className="text-xs font-semibold" style={mutedTextStyle}>
                {t("rule_count", { n: game.ruleCount })} ·{" "}
                {t("updated", {
                    // UTC so the SSR and client renders agree near midnight.
                    date: format.dateTime(new Date(game.updatedAt), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                    }),
                })}
            </p>
            <div className="mt-auto flex flex-col gap-2">
                <GameButton
                    variant="green"
                    size="sm"
                    onClick={handlePlay}
                    disabled={launching}
                    className="w-full"
                >
                    {launching ? t("launching") : t("play")}
                </GameButton>
                <div className="flex gap-2">
                    <GameButton
                        variant="gold"
                        size="sm"
                        href={`/studio/${game.id}`}
                        className="flex-1"
                    >
                        {t("edit")}
                    </GameButton>
                    <GameButton
                        variant="red"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                    >
                        {t("delete")}
                    </GameButton>
                </div>
            </div>
        </article>
    );
}
