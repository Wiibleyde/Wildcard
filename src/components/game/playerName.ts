// Same lookup as lib/games/table/helpers `playerName`, minus its "?" fallback
// so callers can localise the unknown case.
export function findPlayerName(
    players: readonly { readonly userId: string; readonly username: string }[],
    userId: string | null,
): string | null {
    if (!userId) return null;
    return players.find((p) => p.userId === userId)?.username ?? null;
}
