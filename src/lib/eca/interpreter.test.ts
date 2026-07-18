import { describe, expect, it } from "vitest";
import { french52 } from "@/lib/card/decks";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import {
    buildRuleContext,
    cardRankValue,
    type EcaRuleContext,
    evaluateCondition,
    evaluateOperand,
    firstMatchingRule,
    matchingRules,
    ruleHasEffect,
    ruleMatches,
    topOfDiscard,
} from "./interpreter";
import type { EcaCondition, EcaOperand, EcaRule } from "./types";

function card(rank: Rank, suit: Suit = "spades"): CardDescriptor {
    return { type: "suited", suit, rank };
}

function ctx(overrides: Partial<EcaRuleContext> = {}): EcaRuleContext {
    return {
        playedCard: card("7", "hearts"),
        topDiscard: card("K", "hearts"),
        actorHandCount: 3,
        drawPileCount: 10,
        discardPileCount: 4,
        deckRanks: french52.ranks,
        ...overrides,
    };
}

const playedRank: EcaOperand = {
    kind: "card",
    source: "playedCard",
    prop: "rank",
};
const playedSuit: EcaOperand = {
    kind: "card",
    source: "playedCard",
    prop: "suit",
};
const playedValue: EcaOperand = {
    kind: "card",
    source: "playedCard",
    prop: "value",
};
const topValue: EcaOperand = {
    kind: "card",
    source: "topDiscard",
    prop: "value",
};
const literal = (value: string | number): EcaOperand => ({
    kind: "literal",
    value,
});

describe("cardRankValue", () => {
    it("returns the rank index in the deck order (low to high)", () => {
        // french52 ranks: A,2,…,10,J,Q,K — the 7 sits at index 6.
        expect(cardRankValue(card("7"), french52.ranks)).toBe(6);
        expect(cardRankValue(card("A"), french52.ranks)).toBe(0);
        expect(cardRankValue(card("K"), french52.ranks)).toBe(12);
    });

    it("returns null for a rank absent from the deck", () => {
        expect(cardRankValue(card("C"), french52.ranks)).toBeNull();
    });

    it("returns null for non-suited cards", () => {
        expect(cardRankValue({ type: "fool" }, french52.ranks)).toBeNull();
        expect(
            cardRankValue({ type: "trump", index: 5 }, french52.ranks),
        ).toBeNull();
    });
});

describe("evaluateOperand", () => {
    it("reads card props from the played card and the top discard", () => {
        const c = ctx();
        expect(evaluateOperand(playedRank, c)).toBe("7");
        expect(evaluateOperand(playedSuit, c)).toBe("hearts");
        expect(evaluateOperand(playedValue, c)).toBe(6);
        expect(evaluateOperand(topValue, c)).toBe(12); // K
    });

    it("returns null when the source card is missing", () => {
        const empty = ctx({ playedCard: null, topDiscard: null });
        expect(evaluateOperand(playedRank, empty)).toBeNull();
        expect(evaluateOperand(topValue, empty)).toBeNull();
    });

    it("reads stats", () => {
        const c = ctx();
        expect(
            evaluateOperand({ kind: "stat", source: "actorHandCount" }, c),
        ).toBe(3);
        expect(
            evaluateOperand({ kind: "stat", source: "drawPileCount" }, c),
        ).toBe(10);
        expect(
            evaluateOperand({ kind: "stat", source: "discardPileCount" }, c),
        ).toBe(4);
    });

    it("passes literals through unchanged", () => {
        expect(evaluateOperand(literal("hearts"), ctx())).toBe("hearts");
        expect(evaluateOperand(literal(8), ctx())).toBe(8);
    });
});

describe("evaluateCondition", () => {
    const cond = (
        lhs: EcaOperand,
        op: EcaCondition["op"],
        rhs: EcaOperand,
    ): EcaCondition => ({ lhs, op, rhs });

    it("eq/neq compare strictly", () => {
        const c = ctx();
        expect(evaluateCondition(cond(playedRank, "eq", literal("7")), c)).toBe(
            true,
        );
        expect(evaluateCondition(cond(playedRank, "eq", literal("8")), c)).toBe(
            false,
        );
        expect(
            evaluateCondition(cond(playedRank, "neq", literal("8")), c),
        ).toBe(true);
        // "7" (rank string) is NOT the number 7 — no coercion.
        expect(evaluateCondition(cond(playedRank, "eq", literal(7)), c)).toBe(
            false,
        );
    });

    it("compares the played card against the top discard", () => {
        const c = ctx(); // 7♥ on K♥
        expect(
            evaluateCondition(
                cond(playedSuit, "eq", {
                    kind: "card",
                    source: "topDiscard",
                    prop: "suit",
                }),
                c,
            ),
        ).toBe(true);
        expect(evaluateCondition(cond(playedValue, "lt", topValue), c)).toBe(
            true,
        );
        expect(evaluateCondition(cond(playedValue, "gte", topValue), c)).toBe(
            false,
        );
    });

    it("orders numbers with gt/gte/lt/lte", () => {
        const c = ctx();
        const hand: EcaOperand = { kind: "stat", source: "actorHandCount" };
        expect(evaluateCondition(cond(hand, "gt", literal(2)), c)).toBe(true);
        expect(evaluateCondition(cond(hand, "gte", literal(3)), c)).toBe(true);
        expect(evaluateCondition(cond(hand, "lt", literal(3)), c)).toBe(false);
        expect(evaluateCondition(cond(hand, "lte", literal(3)), c)).toBe(true);
    });

    it("is false for numeric comparators over non-numbers (runtime backstop)", () => {
        const c = ctx();
        expect(evaluateCondition(cond(playedRank, "gt", literal("6")), c)).toBe(
            false,
        );
        expect(
            evaluateCondition(cond(literal("a"), "lt", literal("b")), c),
        ).toBe(false);
    });

    it("is false — never true — over missing data, whatever the comparator", () => {
        const empty = ctx({ playedCard: null, topDiscard: null });
        expect(
            evaluateCondition(cond(playedRank, "eq", literal("7")), empty),
        ).toBe(false);
        expect(
            evaluateCondition(cond(playedRank, "neq", literal("7")), empty),
        ).toBe(false);
        expect(
            evaluateCondition(cond(playedValue, "gt", literal(0)), empty),
        ).toBe(false);
    });
});

describe("rule matching", () => {
    const rule = (
        id: string,
        event: EcaRule["event"],
        conditions: EcaCondition[],
    ): EcaRule => ({
        id,
        name: id,
        event,
        conditions,
        effects: [{ type: "acceptCard" }],
    });

    const isSeven: EcaCondition = {
        lhs: playedRank,
        op: "eq",
        rhs: literal("7"),
    };
    const isHearts: EcaCondition = {
        lhs: playedSuit,
        op: "eq",
        rhs: literal("hearts"),
    };
    const isEight: EcaCondition = {
        lhs: playedRank,
        op: "eq",
        rhs: literal("8"),
    };

    it("a rule with no conditions always matches", () => {
        expect(ruleMatches(rule("any", "cardPlayed", []), ctx())).toBe(true);
    });

    it("AND-combines conditions", () => {
        expect(
            ruleMatches(rule("r", "cardPlayed", [isSeven, isHearts]), ctx()),
        ).toBe(true);
        expect(
            ruleMatches(rule("r", "cardPlayed", [isSeven, isEight]), ctx()),
        ).toBe(false);
    });

    it("firstMatchingRule returns the FIRST match in array order", () => {
        const rules = [
            rule("eights", "cardPlayed", [isEight]),
            rule("sevens", "cardPlayed", [isSeven]),
            rule("anything", "cardPlayed", []),
        ];
        expect(firstMatchingRule(rules, "cardPlayed", ctx())?.id).toBe(
            "sevens",
        );
    });

    it("firstMatchingRule ignores rules of another event", () => {
        const rules = [
            rule("on-turn", "turnStarted", []),
            rule("on-play", "cardPlayed", []),
        ];
        expect(firstMatchingRule(rules, "cardPlayed", ctx())?.id).toBe(
            "on-play",
        );
        expect(firstMatchingRule(rules, "turnStarted", ctx())?.id).toBe(
            "on-turn",
        );
    });

    it("firstMatchingRule returns null when nothing matches", () => {
        expect(
            firstMatchingRule(
                [rule("eights", "cardPlayed", [isEight])],
                "cardPlayed",
                ctx(),
            ),
        ).toBeNull();
    });

    it("matchingRules returns every match, in order", () => {
        const rules = [
            rule("a", "turnStarted", []),
            rule("b", "cardPlayed", []),
            rule("c", "turnStarted", [isSeven]),
        ];
        expect(matchingRules(rules, "turnStarted", ctx()).map((r) => r.id)) //
            .toEqual(["a", "c"]);
    });

    it("ruleHasEffect finds an effect by type", () => {
        const r = rule("r", "cardPlayed", []);
        expect(ruleHasEffect(r, "acceptCard")).toBe(true);
        expect(ruleHasEffect(r, "endGame")).toBe(false);
    });
});

describe("context building", () => {
    it("topOfDiscard reads the last element, null when empty", () => {
        expect(topOfDiscard([])).toBeNull();
        expect(topOfDiscard([card("2"), card("9", "clubs")])).toEqual(
            card("9", "clubs"),
        );
    });

    it("buildRuleContext derives counts from the state", () => {
        const c = buildRuleContext(
            {
                hands: { a: [card("2"), card("3")], b: [card("4")] },
                drawPile: [card("5"), card("6"), card("7")],
                discardPile: [card("8"), card("9", "hearts")],
            },
            "a",
            card("J"),
            french52.ranks,
        );
        expect(c.actorHandCount).toBe(2);
        expect(c.drawPileCount).toBe(3);
        expect(c.discardPileCount).toBe(2);
        expect(c.topDiscard).toEqual(card("9", "hearts"));
        expect(c.playedCard).toEqual(card("J"));
    });
});
