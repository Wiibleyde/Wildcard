import type { CSSProperties, ReactNode } from "react";

export type BoardThemeTier =
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mystical"
    | "ethereal";

export interface BoardZone {
    /** CSS background for zone containers (play area, hand area) */
    background: string;
    borderColor: string;
    boxShadow?: string;
}

export interface BoardBadge {
    /** CSS background for player name pills */
    background: string;
    textColor: string;
}

export interface BoardTheme {
    id: string;
    name: string;
    tier: BoardThemeTier;

    surface: {
        /** CSS background shorthand — gradient, solid, or url(...) */
        background: string;
        /** Optional color/gradient layered on top, e.g. "rgba(0,0,0,0.15)" */
        overlay?: string;
        style?: CSSProperties;
    };

    zone: BoardZone;
    badge: BoardBadge;

    /** Accent color for highlights and glow effects */
    accentColor: string;
}

// ── Component props ───────────────────────────────────────────────────────────

export interface BoardPlayer {
    userId: string;
    username: string;
    /** deck_style_id resolved from player_customizations */
    deckStyleId: string;
    isCurrentPlayer: boolean;
}

export interface GameBoardProps {
    theme?: BoardTheme;
    players: BoardPlayer[];
    /** Cards currently in play (center table area) */
    playArea?: ReactNode;
    /** Current player's hand */
    handArea?: ReactNode;
}
