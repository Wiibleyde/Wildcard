"use client";

import { useTranslations } from "next-intl";
import type { EcaValidationError } from "@/lib/eca/validate";

export function ValidationReport({
    errors,
    errorText,
}: {
    readonly errors: readonly EcaValidationError[];
    readonly errorText: (error: EcaValidationError) => string;
}) {
    const t = useTranslations("studio");
    return (
        <div className="rounded-2xl bg-wc-red p-4 text-white shadow-[0_4px_0_var(--red-d)]">
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
