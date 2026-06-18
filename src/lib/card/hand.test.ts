import { describe, expect, it } from "vitest";
import { dealRoundRobin, removeCards } from "./hand";
import type { CardDescriptor } from "./types";

const c = (suit: string, rank: string): CardDescriptor =>
    ({ type: "suited", suit, rank }) as CardDescriptor;

describe("removeCards", () => {
    it("removes one occurrence of each requested card", () => {
        const hand = [c("hearts", "7"), c("spades", "K"), c("clubs", "2")];
        const next = removeCards(hand, [c("spades", "K")]);
        expect(next).not.toBeNull();
        expect(next).toHaveLength(2);
        expect(next?.some((x) => x.type === "suited" && x.rank === "K")).toBe(
            false,
        );
    });

    it("returns null when a card is not held", () => {
        const hand = [c("hearts", "7")];
        expect(removeCards(hand, [c("spades", "K")])).toBeNull();
    });

    it("does not mutate the input hand", () => {
        const hand = [c("hearts", "7"), c("spades", "K")];
        removeCards(hand, [c("hearts", "7")]);
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
