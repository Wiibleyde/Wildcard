import {
    type CardDescriptor,
    RANKS,
    type Rank,
    type Suit,
    type SuitedCard,
} from "./types";

export function isSuited(card: CardDescriptor): card is SuitedCard {
    return card.type === "suited";
}

export function rankOf(card: CardDescriptor): Rank | null {
    return card.type === "suited" ? card.rank : null;
}

const SUIT_COLOR: Record<Suit, "red" | "black"> = {
    spades: "black",
    clubs: "black",
    hearts: "red",
    diamonds: "red",
};

export function suitColor(suit: Suit): "red" | "black" {
    return SUIT_COLOR[suit];
}

/**
 * Rank → strength from an ordered list (weakest first). There is no canonical
 * ranking — Ace high in Bataille, low in Solitaire, below the 2 in Président —
 * so each game owns its order. Unlisted ranks stay 0.
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

/** Suited cards grouped by rank; trumps, fool and jokers are dropped. */
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
