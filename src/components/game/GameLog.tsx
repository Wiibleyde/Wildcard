"use client";

import { buildSurfaceStyle } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";

export interface GameLogLine {
    readonly id: string;
    readonly text: string;
}

interface GameLogProps {
    title: string;
    emptyText: string;
    /** Newest first — the latest move is readable without scrolling. */
    lines: readonly GameLogLine[];
    boardTheme: BoardTheme;
}

/**
 * History feed beside the table — one localized sentence per game event
 * ("Nadia pose 2× 8", "Marc ramasse le pli…"), themed like the board so it
 * reads as part of the table. Sits under the board on mobile, as a right
 * rail from `lg:`.
 */
export function GameLog({ title, emptyText, lines, boardTheme }: GameLogProps) {
    return (
        <aside
            className="flex max-h-44 flex-col overflow-hidden rounded-2xl p-3 lg:max-h-[60vh] lg:w-60 lg:self-start xl:w-72 xl:p-4 2xl:w-80"
            style={buildSurfaceStyle(boardTheme)}
            aria-label={title}
        >
            <h2
                className="mb-2 text-xs font-black uppercase tracking-widest"
                style={{ color: boardTheme.accentColor }}
            >
                {title}
            </h2>
            <ol className="flex flex-col gap-1.5 overflow-y-auto pr-1 text-xs xl:text-sm">
                {lines.length === 0 ? (
                    <li className="text-white/50">{emptyText}</li>
                ) : (
                    lines.map((line, index) => (
                        <li
                            key={line.id}
                            className={
                                index === 0
                                    ? "font-bold text-white/90"
                                    : "text-white/65"
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
