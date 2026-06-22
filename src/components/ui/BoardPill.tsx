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
            ? { background: theme.accentColor, color: "#0d0a05" }
            : buildBadgeStyle(theme);
    const weight = tone === "accent" ? "font-black" : "font-semibold";

    return (
        <span
            className={`rounded-full px-3 py-1 text-xs ${weight} backdrop-blur-sm xl:text-sm`}
            style={{
                ...style,
                outline: outlined
                    ? `2px solid ${theme.accentColor}`
                    : undefined,
            }}
        >
            {children}
        </span>
    );
}
