"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { Switch } from "@/components/ui/Switch";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";

type Props = {
    initialEnabled: boolean;
    initialMessage: string | null;
};

export function MaintenanceControl({ initialEnabled, initialMessage }: Props) {
    const t = useTranslations("admin");
    const tCommon = useTranslations("common");
    const confirm = useConfirm();
    const router = useRouter();

    const [enabled, setEnabled] = useState(initialEnabled);
    const [message, setMessage] = useState(initialMessage ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function apply(next: boolean) {
        // Enabling locks every non-admin out (src/proxy.ts): confirm first.
        if (next && !enabled) {
            const ok = await confirm({
                title: t("maintenance_title"),
                message: t("maintenance_confirm_on"),
                confirmLabel: t("enable"),
                variant: "red",
            });
            if (!ok) return;
        }

        setSaving(true);
        setError(null);
        try {
            const res = await apiFetch("/api/admin/maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    maintenance: next,
                    message: message.trim() || null,
                }),
            });
            if (!res.ok) {
                setError(tCommon("error"));
                return;
            }
            setEnabled(next);
            router.refresh();
        } catch {
            setError(tCommon("error"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <section
            className="panel-d flex flex-col gap-4 p-5 xl:p-6"
            style={
                enabled
                    ? {
                          borderColor: "var(--red)",
                          boxShadow: "0 6px 0 var(--red)",
                      }
                    : undefined
            }
        >
            <h2 className="font-display text-xl leading-none xl:text-2xl">
                {t("maintenance_title")}
            </h2>

            <div className="flex items-center justify-between gap-3">
                <span
                    className="stamp"
                    style={{
                        background: enabled ? "var(--red)" : "var(--green)",
                        color: enabled ? "var(--accent-ink)" : "var(--ink)",
                    }}
                >
                    {enabled
                        ? t("maintenance_active")
                        : t("maintenance_inactive")}
                </span>
                <Switch
                    checked={enabled}
                    onChange={apply}
                    label={t("maintenance_title")}
                    disabled={saving}
                    onColor="var(--red)"
                />
            </div>

            <p className="text-xs font-semibold text-wc-muted">
                {t("maintenance_desc")}
            </p>

            <label className="flex flex-col gap-1.5">
                <span className="font-pixel text-wc-label tracking-wc-cap text-wc-muted uppercase">
                    {t("maintenance_message_label")}
                </span>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder={t("maintenance_message_placeholder")}
                    className="w-full resize-none rounded-xl border-nb border-wc-ink bg-wc-panel-d2 px-3 py-2.5 text-sm font-semibold text-wc-cream outline-none"
                />
            </label>

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <GameButton
                variant="gold"
                size="md"
                onClick={() => apply(enabled)}
                disabled={saving}
            >
                {saving ? tCommon("saving") : tCommon("save")}
            </GameButton>
        </section>
    );
}
