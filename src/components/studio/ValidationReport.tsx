"use client";

import { useTranslations } from "next-intl";
import type { EcaValidationError } from "@/lib/eca/validate";

/**
 * Live validation report for the Studio editor — one line per error, keyed by
 * `path:code`. `errorText` (from {@link import("@/hooks/studio/useEcaEditor").useEcaEditor})
 * turns a known error code into a translated message, falling back to the
 * validator's English message.
 */
export function ValidationReport({
    errors,
    errorText,
}: {
    readonly errors: readonly EcaValidationError[];
    readonly errorText: (error: EcaValidationError) => string;
}) {
    const t = useTranslations("studio");
    return (
        <div
            className="rounded-2xl p-4"
            style={{
                background: "var(--red)",
                border: "2.5px solid var(--ink)",
                boxShadow: "0 4px 0 var(--ink)",
                color: "var(--accent-ink)",
            }}
        >
            <p className="font-display">
                {t("errors_title", { n: errors.length })}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
                {errors.map((error) => (
                    <li
                        key={`${error.path}:${error.code}`}
                        className="text-xs font-semibold"
                    >
                        <span className="opacity-80">{error.path || "—"}</span>{" "}
                        · {errorText(error)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
