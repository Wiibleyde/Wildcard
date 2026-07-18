"use client";

import { useTranslations } from "next-intl";
import type { LogEntry } from "@/hooks/studio/useTestPlay";

/** The sandbox event log — newest first, bounded height, scrolls inside. */
export function TestPlayLog({ log }: { readonly log: readonly LogEntry[] }) {
    const t = useTranslations("studio");
    return (
        <div className="flex flex-col gap-2">
            <h3 className="font-display text-sm text-wc-cream">
                {t("test_log_title")}
            </h3>
            <div
                className="flex h-64 flex-col gap-1 overflow-y-auto rounded-xl p-3 lg:h-80"
                style={{
                    background: "var(--panel-d2)",
                    border: "2.5px solid var(--ink)",
                }}
            >
                {log.length === 0 && (
                    <p className="sub text-xs">{t("test_log_empty")}</p>
                )}
                {log.map((entry) => (
                    <p
                        key={entry.id}
                        className="text-xs font-semibold"
                        style={{ color: "var(--muted)" }}
                    >
                        {entry.text}
                    </p>
                ))}
            </div>
        </div>
    );
}
