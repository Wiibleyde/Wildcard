import type { CSSProperties, ReactNode } from "react";
import type { CardDescriptor } from "@/lib/card/types";

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

/**
 * A card played to the table. Each table card is rendered in its owner's deck
 * style for every viewer — a table mixes styles — while hands stay in the
 * viewer's own style.
 */
export interface TableCard {
    /** Stable unique id — React key and animation tracking */
    id: string;
    card: CardDescriptor;
    /** Seat that played it; resolves to that player's deck style */
    playerId: string;
}

export interface GameBoardProps {
    theme?: BoardTheme;
    players: BoardPlayer[];
    /** Cards currently in play (center table area) */
    playArea?: ReactNode;
    /** Current player's hand */
    handArea?: ReactNode;
    /** Localized hint shown when `playArea` is absent */
    playAreaPlaceholder?: string;
    /** Localized hint shown when `handArea` is absent */
    handPlaceholder?: string;
}
