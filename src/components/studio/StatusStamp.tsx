"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type { StudioMessageKey } from "@/lib/eca/studioMessages";
import type { EcaGameStatus } from "@/lib/models/studio";

type Stamp = EcaGameStatus | "locked";

const STAMPS: Record<
    Stamp,
    { readonly key: StudioMessageKey; readonly style: CSSProperties }
> = {
    draft: {
        key: "status_draft",
        style: { background: "var(--panel-d2)", color: "var(--muted)" },
    },
    published: {
        key: "status_published",
        style: { background: "var(--green)", color: "#fff" },
    },
    locked: {
        key: "moderation_locked_badge",
        style: { background: "var(--red)", color: "#fff" },
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
