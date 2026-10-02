import { nameTag } from "@/lib/models/identities";

interface NamedPlayer {
    readonly userId: string;
    readonly username: string;
}

export interface NameLabels {
    readonly bot: (n: number) => string;
    readonly unknown: (tag: string) => string;
}

// Same lookup as lib/games/table/helpers `playerName`, minus its "?" fallback
// so callers can localise the unknown case.
export function findPlayerName(
    players: readonly NamedPlayer[],
    userId: string | null,
): string | null {
    if (!userId) return null;
    return players.find((p) => p.userId === userId)?.username ?? null;
}

/**
 * The state stores locale-neutral names (`Bot n`, `#tag`) since every locale
 * replays it; bot `n` is 1 + its index in `botIds`.
 */
export function localizePlayers<P extends NamedPlayer>(
    players: readonly P[],
    botIds: readonly string[],
    labels: NameLabels,
): P[] {
    return players.map((p) => {
        const bot = botIds.indexOf(p.userId);
        if (bot !== -1) return { ...p, username: labels.bot(bot + 1) };
        if (p.username === `#${nameTag(p.userId)}`) {
            return { ...p, username: labels.unknown(nameTag(p.userId)) };
        }
        return p;
    });
}
