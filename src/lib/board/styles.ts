import type { CSSProperties } from "react";
import type { BoardTheme } from "@/lib/board/types";

/** Stadium-shaped table: wide rounded ends, flatter long sides. */
export const BOARD_RADIUS = "clamp(2rem, 7vw, 9rem) / clamp(2rem, 6vw, 7rem)";

/** Wooden rim drawn inside the board's edge, plus the drop under the table. */
export const BOARD_RIM =
    "inset 0 0 0 9px #2a1c14, inset 0 0 0 12px #6a4529, inset 0 0 0 14px #2a1c14, inset 0 18px 40px rgba(0,0,0,0.45), 0 8px 0 rgba(0,0,0,0.4)";

export function buildSurfaceStyle(theme: BoardTheme): CSSProperties {
    return { background: theme.surface.background };
}

export function buildZoneStyle(theme: BoardTheme): CSSProperties {
    const { zone } = theme;
    return {
        background: zone.background,
        border: `2.5px solid ${zone.borderColor}`,
        boxShadow: zone.boxShadow,
    };
}

export function buildBadgeStyle(theme: BoardTheme): CSSProperties {
    return {
        background: theme.badge.background,
        color: theme.badge.textColor,
    };
}

// Deterministic from the id so server and client renders agree (no hydration mismatch).
export function tableTilt(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 11) - 5;
}
