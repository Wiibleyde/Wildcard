import type { ThemeTier } from "@/lib/card/types";

export interface BoardZone {
    background: string;
    borderColor: string;
    boxShadow?: string;
    /** Labels drawn on the table surface (placeholders, captions). */
    textColor: string;
}

export interface BoardBadge {
    background: string;
    textColor: string;
}

export interface BoardTheme {
    id: string;
    name: string;
    tier: ThemeTier;
    /** CSS `background` shorthand. */
    surface: { background: string };
    zone: BoardZone;
    badge: BoardBadge;
    accentColor: string;
}
