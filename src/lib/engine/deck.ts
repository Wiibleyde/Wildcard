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

/** Stable identity string — safe as a React key and for equality checks. */
export function cardKey(card: CardDescriptor): string {
    switch (card.type) {
        case "suited":
            return `s:${card.suit}:${card.rank}`;
        case "trump":
            return `t:${card.index}`;
        case "fool":
            return "fool";
        case "joker":
            return `j:${card.variant ?? "red"}`;
    }
}

/** Structural card equality, via {@link cardKey}. */
export function sameCard(a: CardDescriptor, b: CardDescriptor): boolean {
    return cardKey(a) === cardKey(b);
}
