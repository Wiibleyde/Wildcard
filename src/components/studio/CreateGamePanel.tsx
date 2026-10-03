"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/base/input";
import { fieldClass, fieldLabelClass } from "@/components/ui/fields";
import { GameButton } from "@/components/ui/GameButton";
import { postJson } from "@/hooks/studio/postJson";
import { useRouter } from "@/i18n/navigation";
import type { StudioMessageKey } from "@/lib/eca/studioMessages";
import {
    ECA_TEMPLATE_IDS,
    type EcaTemplateId,
    ecaTemplate,
} from "@/lib/eca/templates";
import { ECA_NAME_MAX } from "@/lib/eca/validate";
import { PanelTitle } from "./PanelTitle";

const TEMPLATE_LABELS: Record<
    EcaTemplateId,
    { readonly label: StudioMessageKey; readonly description: StudioMessageKey }
> = {
    blank: { label: "template_blank", description: "template_blank_desc" },
    example: {
        label: "template_example",
        description: "template_example_desc",
    },
};

export function CreateGamePanel({
    atLimit,
    onError,
}: {
    readonly atLimit: boolean;
    readonly onError: (message: string | null) => void;
}) {
    const t = useTranslations("studio");
    const router = useRouter();
    const [name, setName] = useState("");
    const [template, setTemplate] = useState<EcaTemplateId>("blank");
    const [busy, setBusy] = useState(false);
    const trimmed = name.trim();

    async function handleCreate() {
        if (!trimmed || busy || atLimit) return;
        setBusy(true);
        onError(null);
        const base = ecaTemplate(template, t);
        const definition = { ...base, meta: { ...base.meta, name: trimmed } };
        const result = await postJson("/api/studio/games", {
            name: trimmed,
            description: definition.meta.description ?? null,
            definition,
        });
        if (result.ok && typeof result.data.id === "string") {
            // Stay busy while navigating so the button can't double-submit.
            router.push(`/studio/${result.data.id}`);
            return;
        }
        setBusy(false);
        onError(
            !result.ok && result.error === "limit_reached"
                ? t("create_limit")
                : t("create_error"),
        );
    }

    return (
        <section className="panel flex flex-col gap-4 p-5 sm:p-6">
            <PanelTitle>{t("create_title")}</PanelTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ECA_TEMPLATE_IDS.map((id) => {
                    const selected = template === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setTemplate(id)}
                            aria-pressed={selected}
                            className={`wc-press flex flex-col items-start gap-1 rounded-2xl p-4 text-left ${
                                selected
                                    ? "bg-wc-gold text-wc-ink [--press:var(--gold-d)]"
                                    : "bg-wc-panel-d2 text-wc-cream [--press:#110c17]"
                            }`}
                        >
                            <span className="font-display text-lg">
                                {t(TEMPLATE_LABELS[id].label)}
                            </span>
                            <span
                                className={`text-xs font-semibold ${selected ? "text-wc-ink/70" : "text-wc-muted"}`}
                            >
                                {t(TEMPLATE_LABELS[id].description)}
                            </span>
                        </button>
                    );
                })}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <label
                        htmlFor="studio-create-name"
                        className={`${fieldLabelClass} mb-2 block`}
                    >
                        {t("create_name_label")}
                    </label>
                    <Input
                        id="studio-create-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={ECA_NAME_MAX}
                        placeholder={t("create_name_placeholder")}
                        className={`${fieldClass} w-full`}
                    />
                </div>
                <GameButton
                    variant="orange"
                    size="md"
                    onClick={handleCreate}
                    disabled={busy || atLimit || trimmed.length === 0}
                    className="shrink-0"
                >
                    {busy ? t("creating") : t("create")}
                </GameButton>
            </div>
            {atLimit && (
                <p className="text-xs font-semibold text-wc-muted">
                    {t("create_limit")}
                </p>
            )}
        </section>
    );
}
