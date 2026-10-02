import type { CSSProperties } from "react";
import type { BoardTheme } from "@/lib/board/types";

export const BOARD_RADIUS = "clamp(1.125rem, 3vw, 2rem)";

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
