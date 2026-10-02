"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type { EcaGameStatus } from "@/lib/models/studio";
import type { StudioMessageKey } from "./messages";

type Stamp = EcaGameStatus | "locked";

const STAMPS: Record<
    Stamp,
    { readonly key: StudioMessageKey; readonly style: CSSProperties }
> = {
    draft: {
        key: "status_draft",
        style: { background: "var(--cream2)", color: "var(--ink)" },
    },
    published: {
        key: "status_published",
        style: { background: "var(--green)", color: "var(--ink)" },
    },
    locked: {
        key: "moderation_locked_badge",
        style: { background: "var(--red)", color: "var(--accent-ink)" },
    },
};

export function StatusStamp({
    status,
    className = "",
}: {
    readonly status: Stamp;
    readonly className?: string;
}) {
    const t = useTranslations("studio");
    const { key, style } = STAMPS[status];
    return (
        <span className={`stamp ${className}`} style={style}>
            {t(key)}
        </span>
    );
}
