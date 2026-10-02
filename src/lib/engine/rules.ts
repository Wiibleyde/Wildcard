import type {
    ApplyResult,
    GameOutcome,
    GameRuleToggle,
    GameState,
    Player,
} from "./types";

export function fail<S extends GameState>(
    code: string,
    message: string,
): ApplyResult<S> {
    return { ok: false, error: { code, message } };
}

/** Seats, not array order, define turn order — seats can have gaps. */
export function seatOrder(players: readonly Player[]): Player[] {
    return [...players].sort((a, b) => a.seat - b.seat);
}

/** Seat order rotated so that `firstId` comes first (unknown id: no rotation). */
export function rotateFrom(
    players: readonly Player[],
    firstId: string,
): Player[] {
    const order = seatOrder(players);
    const start = Math.max(
        0,
        order.findIndex((p) => p.id === firstId),
    );
    return [...order.slice(start), ...order.slice(0, start)];
}

interface SeatAfterOptions {
    readonly direction?: 1 | -1;
    /** Seats to step over (out of the round, passed…). */
    readonly skip?: (playerId: string) => boolean;
}

/** First seat after `fromId` in turn order that is not skipped; `null` when all are. */
export function seatAfter(
    players: readonly Player[],
    fromId: string,
    { direction = 1, skip }: SeatAfterOptions = {},
): string | null {
    const order = seatOrder(players);
    const n = order.length;
    const start = order.findIndex((p) => p.id === fromId);
    for (let k = 1; k <= n; k++) {
        const candidate = order[(((start + direction * k) % n) + n) % n];
        if (!skip?.(candidate.id)) return candidate.id;
    }
    return null;
}

interface ScoreEntry {
    readonly playerId: string;
    readonly score: number;
}

/** Competition ranking (1, 1, 3…) by score; every player sharing the best score wins. */
export function rankByScore(
    entries: readonly ScoreEntry[],
    { higherIsBetter }: { readonly higherIsBetter: boolean },
): GameOutcome {
    const sign = higherIsBetter ? 1 : -1;
    const sorted = [...entries].sort((x, y) => sign * (y.score - x.score));
    let rank = 0;
    const rankings = sorted.map((entry, index) => {
        if (index === 0 || entry.score !== sorted[index - 1].score) {
            rank = index + 1;
        }
        return { playerId: entry.playerId, rank, score: entry.score };
    });
    return {
        rankings,
        winners: rankings.filter((r) => r.rank === 1).map((r) => r.playerId),
    };
}

type RuleKey<R> = keyof R & string;

/** Lobby toggles derived from a game's default rules, in declaration order. */
export function defineRules<R extends object>(
    defaults: R,
    requires: Partial<Record<RuleKey<R>, RuleKey<R>>> = {},
): GameRuleToggle[] {
    return Object.entries(defaults).map(([key, fallback]) => {
        const dependency = requires[key as RuleKey<R>];
        const toggle = { key, default: fallback === true };
        return dependency === undefined
            ? toggle
            : { ...toggle, requires: dependency };
    });
}

interface BindRulesOptions<R> {
    /**
     * Rules added after launch: bound only when `chosen` names them, so a
     * legacy game's persisted rules (which lack them) rebuild exactly.
     */
    readonly legacyOptional?: readonly RuleKey<R>[];
}

/** Bind a resolved `key → boolean` map onto a game's rules, filling gaps from `defaults`. */
export function bindRules<R extends object>(
    chosen: Readonly<Record<string, boolean>>,
    defaults: R,
    { legacyOptional = [] }: BindRulesOptions<R> = {},
): R {
    const optional: readonly string[] = legacyOptional;
    const bound: Record<string, unknown> = {};
    for (const [key, fallback] of Object.entries(defaults)) {
        const value = chosen[key];
        if (typeof value === "boolean") bound[key] = value;
        else if (!optional.includes(key)) bound[key] = fallback;
    }
    return bound as R;
}
