"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { apiErrorKey } from "@/lib/api/errorKeys";

/** Localized message for an API error code (`null`/unknown → generic). */
export function useApiErrorLabel(): (code: unknown) => string {
    const t = useTranslations("errors");
    return useCallback((code: unknown) => t(apiErrorKey(code)), [t]);
}
