"use client";

import { useTranslations } from "next-intl";

export interface GameLogLine {
    readonly id: string;
    readonly text: string;
}

interface GameLogProps {
    title: string;
    emptyText: string;
    /** Newest first. */
    lines: readonly GameLogLine[];
}

export function GameLog({ title, emptyText, lines }: GameLogProps) {
    const t = useTranslations("game");
    return (
        <aside
            className="panel-d flex h-44 flex-col overflow-hidden p-3 lg:h-auto lg:min-h-0 lg:w-60 lg:flex-3 lg:self-stretch xl:w-72 xl:p-4 2xl:w-80"
            aria-label={title}
        >
            <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-lg leading-none text-wc-cream">
                    {title}
                </h2>
                <span
                    className="stamp"
                    style={{
                        background: "var(--gold)",
                        color: "var(--ink)",
                    }}
                >
                    {t("log_stamp")}
                </span>
            </div>
            <ol className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 text-xs xl:text-sm">
                {lines.length === 0 ? (
                    <li className="text-wc-muted">{emptyText}</li>
                ) : (
                    lines.map((line, index) => (
                        <li
                            key={line.id}
                            className={
                                index === 0
                                    ? "font-bold text-wc-cream"
                                    : "text-wc-cream/70"
                            }
                        >
                            {line.text}
                        </li>
                    ))
                )}
            </ol>
        </aside>
    );
}
