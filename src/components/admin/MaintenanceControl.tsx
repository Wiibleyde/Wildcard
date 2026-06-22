"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { ADMIN } from "./adminTheme";

type Props = {
    initialEnabled: boolean;
    initialMessage: string | null;
};

/**
 * Toggle site-wide maintenance. Enabling locks every non-admin out (enforced
 * in src/proxy.ts), so it confirms first.
 */
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
            const res = await fetch("/api/admin/maintenance", {
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
            className="rounded-2xl p-5 xl:p-6 flex flex-col gap-4"
            style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${enabled ? "rgba(224,64,64,0.4)" : ADMIN.border}`,
            }}
        >
            <div className="flex items-center gap-2.5">
                <h2
                    className="text-lg xl:text-xl font-black"
                    style={{ color: ADMIN.text }}
                >
                    {t("maintenance_title")}
                </h2>
            </div>

            <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{
                    background: enabled
                        ? "rgba(224,64,64,0.1)"
                        : "rgba(72,201,122,0.08)",
                    border: `1px solid ${enabled ? "rgba(224,64,64,0.25)" : "rgba(72,201,122,0.2)"}`,
                }}
            >
                <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                        background: enabled ? ADMIN.danger : ADMIN.success,
                        boxShadow: `0 0 8px ${enabled ? ADMIN.danger : ADMIN.success}`,
                    }}
                />
                <span
                    className="text-sm font-black"
                    style={{ color: enabled ? ADMIN.danger : ADMIN.success }}
                >
                    {enabled
                        ? t("maintenance_active")
                        : t("maintenance_inactive")}
                </span>
            </div>

            <p
                className="text-xs font-semibold"
                style={{ color: ADMIN.textSubtle }}
            >
                {t("maintenance_desc")}
            </p>

            <label className="flex flex-col gap-1.5">
                <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: ADMIN.textMuted }}
                >
                    {t("maintenance_message_label")}
                </span>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder={t("maintenance_message_placeholder")}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold resize-none outline-none"
                    style={{
                        background: "rgba(0,0,0,0.3)",
                        border: `1px solid ${ADMIN.border}`,
                        color: ADMIN.text,
                    }}
                />
            </label>

            {error && (
                <p
                    className="text-xs font-bold"
                    style={{ color: ADMIN.danger }}
                >
                    {error}
                </p>
            )}

            {enabled ? (
                <GameButton
                    variant="green"
                    size="md"
                    onClick={() => apply(false)}
                    disabled={saving}
                >
                    {saving ? tCommon("saving") : t("disable")}
                </GameButton>
            ) : (
                <GameButton
                    variant="red"
                    size="md"
                    onClick={() => apply(true)}
                    disabled={saving}
                >
                    {saving ? tCommon("saving") : t("enable")}
                </GameButton>
            )}
        </section>
    );
}
