"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";

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
            className="panel-d p-5 xl:p-6 flex flex-col gap-4"
            style={
                enabled
                    ? {
                          borderColor: "var(--red)",
                          boxShadow: "0 6px 0 var(--red)",
                      }
                    : undefined
            }
        >
            <div className="flex items-center gap-2.5">
                <h2 className="font-display text-xl xl:text-2xl leading-none">
                    {t("maintenance_title")}
                </h2>
            </div>

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

                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={t("maintenance_title")}
                    onClick={() => apply(!enabled)}
                    disabled={saving}
                    className="relative shrink-0 disabled:opacity-50 disabled:cursor-default"
                    style={{
                        width: 62,
                        height: 34,
                        borderRadius: 10,
                        border: "2.5px solid var(--ink)",
                        background: enabled ? "var(--red)" : "var(--panel-d2)",
                        transition: "background 0.12s",
                        cursor: saving ? "default" : "pointer",
                    }}
                >
                    <span
                        className="absolute top-1/2"
                        style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background: "var(--gold)",
                            border: "2.5px solid var(--ink)",
                            boxShadow: "0 3px 0 var(--ink)",
                            transform: `translateY(-50%) translateX(${enabled ? 30 : 3}px)`,
                            transition:
                                "transform 0.14s cubic-bezier(0.3,0.8,0.3,1)",
                        }}
                    />
                </button>
            </div>

            <p
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
            >
                {t("maintenance_desc")}
            </p>

            <label className="flex flex-col gap-1.5">
                <span
                    className="uppercase"
                    style={{
                        fontFamily: "var(--pixel)",
                        fontSize: 10,
                        letterSpacing: "0.02em",
                        color: "var(--muted)",
                    }}
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
                        background: "var(--panel-d2)",
                        border: "2.5px solid var(--ink)",
                        color: "var(--cream)",
                    }}
                />
            </label>

            {error && (
                <p
                    className="text-xs font-bold"
                    style={{ color: "var(--red)" }}
                >
                    {error}
                </p>
            )}

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
