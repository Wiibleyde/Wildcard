import { describe, expect, it } from "vitest";
import { comparatorsFor, reconcileCondition } from "./schema";
import type { EcaCondition, EcaOperand } from "./types";

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
const handCount: EcaOperand = { kind: "stat", source: "actorHandCount" };

describe("reconcileCondition", () => {
    it("resets a rank literal the new deck does not have", () => {
        const two: EcaCondition = {
            lhs: playedRank,
            op: "eq",
            rhs: { kind: "literal", value: "2" },
        };
        expect(reconcileCondition(two, "french32").rhs).toEqual({
            kind: "literal",
            value: "7",
        });
        expect(reconcileCondition(two, "french52")).toEqual(two);
    });

    it("coerces the literal and the comparator when a side changes domain", () => {
        const next = reconcileCondition(
            { lhs: playedSuit, op: "gt", rhs: { kind: "literal", value: 3 } },
            "french52",
        );
        expect(next).toEqual({
            lhs: playedSuit,
            op: "eq",
            rhs: { kind: "literal", value: "spades" },
        });
    });

    it("keeps order comparators between numbers", () => {
        expect(
            comparatorsFor(handCount, { kind: "literal", value: 2 }),
        ).toContain("gt");
        expect(comparatorsFor(playedRank, playedRank)).toEqual(["eq", "neq"]);
    });
});
