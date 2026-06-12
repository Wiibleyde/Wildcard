"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

function EyeIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            className="w-3 h-3"
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
            className="w-2.5 h-2.5"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M2 6l3 3 5-5"
                stroke="#0d0a05"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

type Props = {
    selected: boolean;
    onClick: () => void;
    previewHref: string;
    children: React.ReactNode;
};

export function TileShell({ selected, onClick, previewHref, children }: Props) {
    const t = useTranslations("customize");
    return (
        <div
            className="relative rounded-xl overflow-hidden transition-all"
            style={{
                background: selected ? "rgba(245,197,22,0.07)" : "#1c1510",
                border: `2px solid ${selected ? "rgba(245,197,22,0.55)" : "#3d2d18"}`,
                boxShadow: selected
                    ? "0 0 16px rgba(245,197,22,0.15), 0 4px 0 0 rgba(245,197,22,0.2)"
                    : "0 3px 0 0 rgba(0,0,0,0.4)",
            }}
        >
            <button
                type="button"
                onClick={onClick}
                className="w-full flex flex-col items-center gap-2 p-3 pb-7 cursor-pointer"
            >
                {children}
                {selected && (
                    <div
                        className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center"
                        style={{
                            background: "#f5c516",
                            boxShadow: "0 0 8px rgba(245,197,22,0.4)",
                        }}
                    >
                        <CheckIcon />
                    </div>
                )}
            </button>
            <Link
                href={previewHref}
                className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{
                    background: "rgba(0,0,0,0.4)",
                    color: "#7a6a50",
                    borderTop: "1px solid #3d2d18",
                }}
            >
                <EyeIcon />
                <span>{t("preview_action")}</span>
            </Link>
        </div>
    );
}
