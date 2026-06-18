import { describe, expect, it } from "vitest";
import {
    buildRankOrder,
    groupByRank,
    isSuited,
    rankOf,
    suitColor,
} from "./rank";
import type { CardDescriptor } from "./types";

const suited = (suit: string, rank: string): CardDescriptor =>
    ({ type: "suited", suit, rank }) as CardDescriptor;

describe("isSuited / rankOf", () => {
    it("narrows suited cards and reads their rank", () => {
        const card = suited("hearts", "K");
        expect(isSuited(card)).toBe(true);
        expect(rankOf(card)).toBe("K");
    });

    it("rejects non-suited cards", () => {
        const fool: CardDescriptor = { type: "fool" };
        expect(isSuited(fool)).toBe(false);
        expect(rankOf(fool)).toBeNull();
    });
});

describe("suitColor", () => {
    it("maps suits to their colour", () => {
        expect(suitColor("spades")).toBe("black");
        expect(suitColor("clubs")).toBe("black");
        expect(suitColor("hearts")).toBe("red");
        expect(suitColor("diamonds")).toBe("red");
    });
});

describe("buildRankOrder", () => {
    it("assigns 1..n in the given order", () => {
        const order = buildRankOrder(["3", "4", "5"]);
        expect(order["3"]).toBe(1);
        expect(order["4"]).toBe(2);
        expect(order["5"]).toBe(3);
    });

    it("leaves ranks not in the list at 0", () => {
        // Solitaire's order omits the Cavalier — it must stay 0.
        const order = buildRankOrder(["A", "2", "10", "J", "Q", "K"]);
        expect(order.C).toBe(0);
    });

    it("encodes each game's own hierarchy by relative value", () => {
        // Président: the 2 beats the Ace.
        const president = buildRankOrder([
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "J",
            "C",
            "Q",
            "K",
            "A",
            "2",
        ]);
        expect(president["2"]).toBeGreaterThan(president.A);
        expect(president.A).toBeGreaterThan(president.K);

        // Bataille: the Ace is highest, the 2 lowest.
        const bataille = buildRankOrder([
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "J",
            "C",
            "Q",
            "K",
            "A",
        ]);
        expect(bataille.A).toBeGreaterThan(bataille["2"]);
    });
});

describe("groupByRank", () => {
    it("groups suited cards by rank and drops non-suited", () => {
        const groups = groupByRank([
            suited("hearts", "7"),
            suited("spades", "7"),
            suited("clubs", "K"),
            { type: "joker" },
        ]);
        expect(groups.get("7")).toHaveLength(2);
        expect(groups.get("K")).toHaveLength(1);
        expect(groups.size).toBe(2);
    });
});
