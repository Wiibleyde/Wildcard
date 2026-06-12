import type { CSSProperties } from "react";
import type { BoardTheme } from "@/lib/board/types";

/**
 * Shared style builders for board chrome. Every surface that renders a
 * {@link BoardTheme} (game table, customization preview) derives its inline
 * styles from these helpers so themes look identical everywhere.
 */

/** Felt/table background, with the optional overlay layered on top. */
export function buildSurfaceStyle(theme: BoardTheme): CSSProperties {
    const { surface } = theme;
    if (surface.overlay) {
        return {
            background: `${surface.overlay}, ${surface.background}`,
            ...surface.style,
        };
    }
    return { background: surface.background, ...surface.style };
}

/** Framed zone panel (play area, hand area). */
export function buildZoneStyle(theme: BoardTheme): CSSProperties {
    const { zone } = theme;
    return {
        background: zone.background,
        border: `1px solid ${zone.borderColor}`,
        boxShadow: zone.boxShadow,
    };
}

/** Player name pill. */
export function buildBadgeStyle(theme: BoardTheme): CSSProperties {
    return {
        background: theme.badge.background,
        color: theme.badge.textColor,
    };
}

/**
 * Deterministic tilt in [-5°, +5°] derived from the card id — gives the
 * "thrown on the table" look while staying identical between server and
 * client renders (no hydration mismatch).
 */
export function tableTilt(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 11) - 5;
}
