import type { TableContext } from "./types";

/**
 * Resolve a player's display name from the render context, falling back to "?"
 * for unknown or missing ids. Shared by every game's `mapView`/`logLine` so the
 * lookup lives in one place instead of being re-declared per table config.
 */
export function playerName(ctx: TableContext, playerId: unknown): string {
    if (typeof playerId !== "string") return "?";
    return ctx.players.find((p) => p.userId === playerId)?.username ?? "?";
}
