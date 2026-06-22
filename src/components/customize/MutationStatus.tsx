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
                className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#f5c516" }}
            />
        );
    }

    if (status === "error") {
        return (
            <span
                className="text-xs font-bold normal-case tracking-normal"
                style={{ color: "#e04040" }}
            >
                {tCommon("error")}
            </span>
        );
    }

    return null;
}
