"use client";

import { useTranslations } from "next-intl";
import type { MutationStatus as Status } from "@/hooks/useApiMutation";

type Props = {
    status: Status;
};

export function MutationStatus({ status }: Props) {
    const tCommon = useTranslations("common");

    if (status === "pending") {
        return (
            <span
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--gold)" }}
            />
        );
    }

    if (status === "error") {
        return (
            <span
                className="text-xs font-bold normal-case tracking-normal"
                style={{ color: "var(--red)" }}
            >
                {tCommon("error")}
            </span>
        );
    }

    return null;
}
