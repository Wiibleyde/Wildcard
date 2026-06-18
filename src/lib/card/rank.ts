import {
    type CardDescriptor,
    RANKS,
    type Rank,
    type Suit,
    type SuitedCard,
} from "./types";

/**
 * Shared, game-agnostic card-rule helpers. Every game reads rank/suit and
 * compares strength the same way; only the *order* differs. Centralizing the
 * predicates here (instead of re-deriving them in each module) keeps a single
 * source of truth and means a new game ships rules, not boilerplate.
 *
 * What is NOT here: a single canonical ranking. Ace is high in Bataille, low
 * in Solitaire, and 2 beats Ace in Président — so each module owns its order
 * via {@link buildRankOrder}, which turns an ordered rank list into the lookup
 * map those modules used to hand-write (and risk a typo in).
 */

/** Narrow a descriptor to the suit+rank arm. */
export function isSuited(card: CardDescriptor): card is SuitedCard {
    return card.type === "suited";
}

/** The rank of a suited card, or `null` for trumps / fool / joker. */
export function rankOf(card: CardDescriptor): Rank | null {
    return card.type === "suited" ? card.rank : null;
}

/** Colour of a suit — the alternating-colour rule Solitaire (and others) need. */
export const SUIT_COLOR: Record<Suit, "red" | "black"> = {
    spades: "black",
    clubs: "black",
    hearts: "red",
    diamonds: "red",
};

export function suitColor(suit: Suit): "red" | "black" {
    return SUIT_COLOR[suit];
}

/**
 * Build a rank→strength lookup from an ordered list (weakest first). Listed
 * ranks get 1…n; any rank a game never uses (e.g. the Cavalier in a french52
 * game) stays 0, so the result is always a total `Record<Rank, number>` and
 * comparisons depend only on the *relative* order you pass.
 *
 * @example bataille (Ace high): buildRankOrder(["2", …, "K", "A"])
 * @example président (2 high):  buildRankOrder(["3", …, "A", "2"])
 */
export function buildRankOrder(order: readonly Rank[]): Record<Rank, number> {
    const map = Object.fromEntries(RANKS.map((r) => [r, 0])) as Record<
        Rank,
        number
    >;
    order.forEach((rank, index) => {
        map[rank] = index + 1;
    });
    return map;
}

/**
 * Group cards by rank, dropping non-suited cards (trumps/fool/joker). The
 * shared primitive behind "what can I lay?" in shedding games (Président,
 * Kems) and any set/pair detection.
 */
export function groupByRank(
    cards: readonly CardDescriptor[],
): Map<Rank, CardDescriptor[]> {
    const groups = new Map<Rank, CardDescriptor[]>();
    for (const card of cards) {
        const rank = rankOf(card);
        if (rank === null) continue;
        const group = groups.get(rank);
        if (group) group.push(card);
        else groups.set(rank, [card]);
    }
    return groups;
}
