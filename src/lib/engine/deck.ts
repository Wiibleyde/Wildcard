import type { DeckDefinition } from "@/lib/card/decks";
import type {
    CardDescriptor,
    JokerVariant,
    TrumpIndex,
} from "@/lib/card/types";

/**
 * Expand a {@link DeckDefinition} into the concrete, ordered list of cards it
 * contains. Order is canonical (unshuffled) — callers shuffle via an `Rng`.
 */
export function buildDeck(def: DeckDefinition): CardDescriptor[] {
    const cards: CardDescriptor[] = [];

    for (const suit of def.suits) {
        for (const rank of def.ranks) {
            cards.push({ type: "suited", suit, rank });
        }
    }

    if (def.trumpCount) {
        for (let i = 1; i <= def.trumpCount; i++) {
            cards.push({ type: "trump", index: i as TrumpIndex });
        }
    }

    if (def.hasFool) {
        cards.push({ type: "fool" });
    }

    if (def.jokers) {
        const variants: readonly JokerVariant[] = ["red", "black"];
        for (let i = 0; i < def.jokers; i++) {
            cards.push({ type: "joker", variant: variants[i] });
        }
    }

    return def.doubled ? [...cards, ...cards] : cards;
}
