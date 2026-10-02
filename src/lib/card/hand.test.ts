import { describe, expect, it } from "vitest";
import { dealRoundRobin, takeCards } from "./hand";
import type { CardDescriptor } from "./types";

const c = (suit: string, rank: string): CardDescriptor =>
    ({ type: "suited", suit, rank }) as CardDescriptor;

describe("takeCards", () => {
    it("takes one occurrence of each requested card", () => {
        const hand = [c("hearts", "7"), c("spades", "K"), c("clubs", "2")];
        const next = takeCards(hand, [c("spades", "K")]);
        expect(next?.remaining).toHaveLength(2);
        expect(next?.taken).toEqual([c("spades", "K")]);
    });

    it("returns the hand's own copies, not the requested objects", () => {
        const hand = [c("spades", "K")];
        const forged = { type: "suited", suit: "spades", rank: "K", x: 1 };
        expect(takeCards(hand, [forged])?.taken[0]).toBe(hand[0]);
    });

    it("returns null when a card is not held or malformed", () => {
        const hand = [c("hearts", "7"), c("spades", "2")];
        expect(takeCards(hand, [c("spades", "K")])).toBeNull();
        expect(
            takeCards(hand, [c("hearts", "7"), c("hearts", "7")]),
        ).toBeNull();
        expect(
            takeCards(hand, [{ type: "suited", suit: "spades", rank: 2 }]),
        ).toBeNull();
    });

    it("does not mutate the input hand", () => {
        const hand = [c("hearts", "7"), c("spades", "K")];
        takeCards(hand, [c("hearts", "7")]);
        expect(hand).toHaveLength(2);
    });
});

describe("dealRoundRobin", () => {
    it("deals cards one at a time across the hands", () => {
        const deck = Array.from({ length: 6 }, (_, i) =>
            c("hearts", String(i)),
        );
        const hands = dealRoundRobin(deck, 3);
        expect(hands).toHaveLength(3);
        expect(hands.every((h) => h.length === 2)).toBe(true);
        // Round-robin: hand 0 gets the 1st and 4th card.
        expect(hands[0]).toEqual([deck[0], deck[3]]);
    });

    it("distributes a remainder to the earliest hands", () => {
        const deck = Array.from({ length: 5 }, (_, i) =>
            c("hearts", String(i)),
        );
        const hands = dealRoundRobin(deck, 2);
        expect(hands[0]).toHaveLength(3);
        expect(hands[1]).toHaveLength(2);
    });
});
