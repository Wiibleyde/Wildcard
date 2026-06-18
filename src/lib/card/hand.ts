import type { Rng } from "@/lib/engine/rng";
import type { CardDescriptor } from "./types";
import { cardKey } from "./utils";

/**
 * Hand-manipulation helpers shared by every card game. These are the verbs a
 * game's reducer performs on a player's hand — kept pure and identity-based
 * (via {@link cardKey}) so they work for any deck.
 */

/**
 * Remove one occurrence of each of `cards` from `hand`, returning the new hand
 * — or `null` if any requested card is not actually held. The `null` is what
 * lets a reducer reject "played a card not in hand" without trusting the
 * client. Matches by {@link cardKey}, so two physical copies (Pinochle) are
 * removed one at a time.
 */
export function removeCards(
    hand: readonly CardDescriptor[],
    cards: readonly CardDescriptor[],
): readonly CardDescriptor[] | null {
    const remaining = [...hand];
    for (const card of cards) {
        const key = cardKey(card);
        const index = remaining.findIndex((c) => cardKey(c) === key);
        if (index === -1) return null;
        remaining.splice(index, 1);
    }
    return remaining;
}

/**
 * Deal a shuffled deck round-robin into `count` hands (one card each in turn).
 * The default deal for trick/shedding games (Président, Belote, Tarot). Returns
 * `count` hands in order; callers map them onto seated players.
 */
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

/** Re-export so a game can shuffle+deal from one import. */
export type { Rng };
