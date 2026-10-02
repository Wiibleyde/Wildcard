"use client";

import { useTranslations } from "next-intl";
import type { GameLogLine } from "@/hooks/game/logLines";
import { RailPanel } from "./RailPanel";

/** `lines` newest first. */
export function GameLog({ lines }: { lines: readonly GameLogLine[] }) {
    const t = useTranslations("game");
    return (
        <RailPanel
            title={t("log_title")}
            stamp={t("log_stamp")}
            tone="gold"
            className="h-44 lg:flex-3"
        >
            <ol className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 text-xs xl:text-sm">
                {lines.length === 0 ? (
                    <li className="text-wc-muted">{t("log_empty")}</li>
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
        </RailPanel>
    );
}
