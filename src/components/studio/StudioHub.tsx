"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { useRouter } from "@/i18n/navigation";
import { CRAZY_EIGHTS_LIKE, MINIMAL_VALID } from "@/lib/eca/fixtures";
import type { EcaDefinition } from "@/lib/eca/types";
import { ECA_NAME_MAX } from "@/lib/eca/validate";
import type { Translate } from "@/lib/games/catalogView";
// Client-safe: models/studio only pulls @/lib/eca at runtime (supabase imports are type-only).
import { MAX_ECA_GAMES_PER_OWNER } from "@/lib/models/studio";
import { fieldClass, fieldStyle, labelClass, labelStyle } from "./fields";

/**
 * Studio landing island: the creator's games (server-fetched through the RLS
 * client, passed down as summaries) plus the create flow — pick a template,
 * name it, POST, and jump into the editor.
 */

export interface StudioGameSummary {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: "draft" | "published";
    readonly ruleCount: number;
    /** Display-ready public cover URL (already resolved), or null. */
    readonly imageUrl: string | null;
    readonly updatedAt: string;
}

type TemplateId = "blank" | "example";

const TEMPLATES: ReadonlyArray<{
    readonly id: TemplateId;
    readonly labelKey: string;
    readonly descKey: string;
    readonly definition: EcaDefinition;
}> = [
    {
        id: "blank",
        labelKey: "template_blank",
        descKey: "template_blank_desc",
        definition: MINIMAL_VALID,
    },
    {
        id: "example",
        labelKey: "template_example",
        descKey: "template_example_desc",
        definition: CRAZY_EIGHTS_LIKE,
    },
];

interface Props {
    readonly games: readonly StudioGameSummary[];
}

export function StudioHub({ games }: Props) {
    const t = useTranslations("studio");
    // Dynamic template labelKey lookups need the loose Translate shape.
    const td = useTranslations("studio") as unknown as Translate;
    const locale = useLocale();
    const router = useRouter();
    const confirm = useConfirm();

    const [name, setName] = useState("");
    const [template, setTemplate] = useState<TemplateId>("blank");
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Mirrors the server-side per-owner cap — no doomed POST, instant hint.
    const atLimit = games.length >= MAX_ECA_GAMES_PER_OWNER;

    // timeZone pinned so the SSR (UTC) and client renders agree near midnight.
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

    async function handleCreate() {
        const trimmed = name.trim();
        if (!trimmed || busy || atLimit) return;
        setBusy(true);
        setError(null);
        try {
            const base =
                TEMPLATES.find((entry) => entry.id === template)?.definition ??
                MINIMAL_VALID;
            const definition: EcaDefinition = {
                ...base,
                meta: { ...base.meta, name: trimmed },
            };
            const payload: Record<string, unknown> = {
                name: trimmed,
                definition,
            };
            if (definition.meta.description !== undefined) {
                payload.description = definition.meta.description;
            }
            const res = await fetch("/api/studio/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = (await res.json().catch(() => ({}))) as {
                id?: unknown;
                error?: unknown;
            };
            if (!res.ok || typeof data.id !== "string") {
                setError(
                    data.error === "limit_reached"
                        ? t("create_limit")
                        : t("create_error"),
                );
                setBusy(false);
                return;
            }
            router.push(`/studio/${data.id}`);
        } catch {
            setError(t("create_error"));
            setBusy(false);
        }
    }

    async function handleDelete(game: StudioGameSummary) {
        const accepted = await confirm({
            title: t("delete"),
            message: t("delete_confirm", { name: game.name }),
            confirmLabel: t("delete"),
            variant: "red",
        });
        if (!accepted) return;
        setDeleting(game.id);
        setError(null);
        const res = await fetch(`/api/studio/games/${game.id}`, {
            method: "DELETE",
        });
        setDeleting(null);
        if (!res.ok) {
            setError(t("delete_error"));
            return;
        }
        router.refresh();
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Create a new game from a template. */}
            <section className="panel flex flex-col gap-4 p-5 sm:p-6">
                <h2
                    className="font-display text-xl"
                    style={{ color: "var(--ink)" }}
                >
                    {t("create_title")}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {TEMPLATES.map((entry) => {
                        const selected = template === entry.id;
                        return (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => setTemplate(entry.id)}
                                aria-pressed={selected}
                                className="lift flex flex-col items-start gap-1 rounded-2xl p-4 text-left"
                                style={{
                                    background: selected
                                        ? "var(--gold)"
                                        : "var(--cream2)",
                                    border: "2.5px solid var(--ink)",
                                    boxShadow: "0 4px 0 var(--ink)",
                                    color: "var(--ink)",
                                }}
                            >
                                <span className="font-display text-lg">
                                    {td(entry.labelKey)}
                                </span>
                                <span
                                    className="text-xs font-semibold"
                                    style={{ color: "#5a5340" }}
                                >
                                    {td(entry.descKey)}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                        <label
                            htmlFor="studio-create-name"
                            className={`${labelClass} mb-2 block`}
                            style={labelStyle}
                        >
                            {t("create_name_label")}
                        </label>
                        <input
                            id="studio-create-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={ECA_NAME_MAX}
                            placeholder={t("create_name_placeholder")}
                            className={`${fieldClass} w-full`}
                            style={fieldStyle}
                        />
                    </div>
                    <GameButton
                        variant="red"
                        size="md"
                        onClick={handleCreate}
                        disabled={busy || atLimit || name.trim().length === 0}
                        className="shrink-0"
                    >
                        {busy ? t("creating") : t("create")}
                    </GameButton>
                </div>
                {atLimit && (
                    <p
                        className="text-xs font-semibold"
                        style={{ color: "#5a5340" }}
                    >
                        {t("create_limit")}
                    </p>
                )}
            </section>

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

            {/* Existing games. */}
            <section className="flex flex-col gap-4">
                <h2 className="font-display text-xl text-wc-cream">
                    {t("my_games")}
                </h2>
                {games.length === 0 ? (
                    <div className="panel-d p-6">
                        <p className="sub text-sm">{t("empty")}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {games.map((game) => (
                            <article
                                key={game.id}
                                className="panel lift flex flex-col gap-3 p-4 sm:p-5"
                            >
                                {game.imageUrl && (
                                    <div
                                        className="relative aspect-video w-full overflow-hidden rounded-xl"
                                        style={{
                                            border: "2.5px solid var(--ink)",
                                        }}
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
                                            ? t("status_published")
                                            : t("status_draft")}
                                    </span>
                                </div>
                                {game.description && (
                                    <p
                                        className="line-clamp-2 text-xs font-semibold"
                                        style={{ color: "#5a5340" }}
                                    >
                                        {game.description}
                                    </p>
                                )}
                                <p
                                    className="text-xs font-semibold"
                                    style={{ color: "#5a5340" }}
                                >
                                    {t("rule_count", { n: game.ruleCount })} ·{" "}
                                    {t("updated", {
                                        date: formatDate(game.updatedAt),
                                    })}
                                </p>
                                <div className="mt-auto flex gap-2">
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
                                        onClick={() => handleDelete(game)}
                                        disabled={deleting !== null}
                                    >
                                        {t("delete")}
                                    </GameButton>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
