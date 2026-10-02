"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { Link } from "@/i18n/navigation";
import type { ThemeTier } from "@/lib/card/types";

function EyeIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
        >
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
            <circle cx="8" cy="8" r="2" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            viewBox="0 0 12 12"
            className="h-2.5 w-2.5"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M2 6l3 3 5-5"
                stroke="var(--accent-ink)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

type Props = {
    name: string;
    tier: ThemeTier;
    selected: boolean;
    onClick: () => void;
    previewHref: string;
    /** The theme swatch. */
    children: ReactNode;
};

export function TileShell({
    name,
    tier,
    selected,
    onClick,
    previewHref,
    children,
}: Props) {
    const t = useTranslations("customize");
    return (
        <div
            className="panel lift relative overflow-hidden"
            style={{
                borderColor: selected ? "var(--red)" : "var(--ink)",
                borderWidth: selected ? "3.5px" : "2.5px",
            }}
        >
            <button
                type="button"
                onClick={onClick}
                aria-pressed={selected}
                className="flex w-full cursor-pointer flex-col items-center gap-2 p-3 pb-8"
            >
                {children}
                <span className="w-full truncate text-center font-display text-xs text-wc-ink">
                    {name}
                </span>
                <TierBadge tier={tier} />
                {selected && (
                    // aria-pressed already announces the state.
                    <span
                        aria-hidden="true"
                        title={t("selected")}
                        className="stamp absolute top-1.5 left-1.5"
                        style={{
                            background: "var(--red)",
                            color: "var(--accent-ink)",
                            padding: "5px",
                        }}
                    >
                        <CheckIcon />
                    </span>
                )}
            </button>
            <Link
                href={previewHref}
                className="stamp absolute bottom-1.5 left-1/2 -translate-x-1/2"
                style={{ background: "var(--cream2)", color: "var(--ink)" }}
            >
                <EyeIcon />
                <span>{t("preview_action")}</span>
            </Link>
        </div>
    );
}
