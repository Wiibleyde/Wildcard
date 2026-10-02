import type { CardDescriptor } from "./types";
import { cardKey, isCardDescriptor } from "./utils";

/**
 * Take one occurrence of each requested (untrusted) card out of `hand`, or
 * `null` if any is malformed or not held. `taken` holds the hand's own
 * copies: reducers store those, never the client's objects.
 */
export function takeCards(
    hand: readonly CardDescriptor[],
    requested: readonly unknown[],
): { taken: CardDescriptor[]; remaining: CardDescriptor[] } | null {
    const remaining = [...hand];
    const taken: CardDescriptor[] = [];
    for (const card of requested) {
        if (!isCardDescriptor(card)) return null;
        const key = cardKey(card);
        const index = remaining.findIndex((c) => cardKey(c) === key);
        if (index === -1) return null;
        taken.push(remaining[index]);
        remaining.splice(index, 1);
    }
    return { taken, remaining };
}

export function dealRoundRobin(
    deck: readonly CardDescriptor[],
    count: number,
): CardDescriptor[][] {
    const hands: CardDescriptor[][] = Array.from({ length: count }, () => []);
    deck.forEach((card, i) => {
        hands[i % count].push(card);
    });
    return hands;
}
