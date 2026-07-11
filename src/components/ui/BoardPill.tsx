import { buildBadgeStyle } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";

interface BoardPillProps {
    children: React.ReactNode;
    theme: BoardTheme;
    /** `badge` — player-name colors; `accent` — high-contrast role markers. */
    tone?: "badge" | "accent";
    /** Outline in the accent color (active turn marker). */
    outlined?: boolean;
}

export function BoardPill({
    children,
    theme,
    tone = "badge",
    outlined = false,
}: BoardPillProps) {
    const style =
        tone === "accent"
            ? { background: theme.accentColor, color: "var(--ink)" }
            : buildBadgeStyle(theme);

    return (
        <span
            className="inline-flex items-center rounded-full border-nb px-3 py-1 font-display text-xs xl:text-sm"
            style={{
                ...style,
                borderColor: "var(--ink)",
                boxShadow: outlined
                    ? `0 0 0 3px ${theme.accentColor}, 0 4px 0 var(--ink)`
                    : "0 4px 0 var(--ink)",
            }}
        >
            {children}
        </span>
    );
}
