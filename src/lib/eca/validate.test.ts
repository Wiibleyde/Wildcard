import { describe, expect, it } from "vitest";
import { CRAZY_EIGHTS_LIKE, MINIMAL_VALID } from "./fixtures";
import type { EcaDefinition, EcaRule } from "./types";
import { validateEcaDefinition } from "./validate";

const base: EcaDefinition = MINIMAL_VALID;
const baseRule: EcaRule = base.rules[0];

/** Run the validator on a broken input and return the error codes. */
function errorsOf(input: unknown): string[] {
    const result = validateEcaDefinition(input);
    if (result.ok) throw new Error("expected validation to fail");
    return result.errors.map((e) => e.code);
}

const withMeta = (patch: Record<string, unknown>): unknown => ({
    ...base,
    meta: { ...base.meta, ...patch },
});
const withSetup = (patch: Record<string, unknown>): unknown => ({
    ...base,
    setup: { ...base.setup, ...patch },
});
const withRules = (rules: unknown): unknown => ({ ...base, rules });

describe("validateEcaDefinition — acceptance", () => {
    it("accepts the fixtures and rebuilds them identically", () => {
        for (const fixture of [MINIMAL_VALID, CRAZY_EIGHTS_LIKE]) {
            const result = validateEcaDefinition(fixture);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.definition).toEqual(fixture);
        }
    });

    it("strips unknown extra keys on rebuild", () => {
        const result = validateEcaDefinition({ ...base, extra: "junk" });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.definition).toEqual(base);
    });

    it("accepts a turnStarted rule with turn-legal effects", () => {
        const result = validateEcaDefinition(
            withRules([
                baseRule,
                {
                    id: "turn-rule",
                    name: "Pioche au début du tour",
                    event: "turnStarted",
                    conditions: [
                        {
                            lhs: { kind: "stat", source: "actorHandCount" },
                            op: "lte",
                            rhs: { kind: "literal", value: 2 },
                        },
                    ],
                    effects: [
                        { type: "drawCards", target: "actor", count: 1 },
                        { type: "skipNextPlayer" },
                        { type: "reverseDirection" },
                        { type: "endGame", winner: "actor" },
                    ],
                },
            ]),
        );
        expect(result.ok).toBe(true);
    });

    it("reports every error at once, not just the first", () => {
        const codes = errorsOf({
            ...base,
            version: 2,
            meta: { ...base.meta, name: "" },
        });
        expect(codes).toContain("invalid_version");
        expect(codes).toContain("invalid_name");
    });
});

describe("validateEcaDefinition — structure", () => {
    it("not_object: rejects non-object input", () => {
        expect(errorsOf(null)).toContain("not_object");
        expect(errorsOf(42)).toContain("not_object");
        expect(errorsOf("nope")).toContain("not_object");
        expect(errorsOf([base])).toContain("not_object");
    });

    it("not_object: rejects missing sections", () => {
        expect(errorsOf({ ...base, meta: undefined })).toContain("not_object");
        expect(errorsOf({ ...base, setup: 3 })).toContain("not_object");
        expect(errorsOf({ ...base, turn: [] })).toContain("not_object");
    });

    it("invalid_version: rejects any version but 1", () => {
        expect(errorsOf({ ...base, version: 2 })).toContain("invalid_version");
        expect(errorsOf({ ...base, version: "1" })).toContain(
            "invalid_version",
        );
    });
});

describe("validateEcaDefinition — meta", () => {
    it("invalid_name: rejects empty and over-long names", () => {
        expect(errorsOf(withMeta({ name: "" }))).toContain("invalid_name");
        expect(errorsOf(withMeta({ name: "x".repeat(61) }))).toContain(
            "invalid_name",
        );
        expect(errorsOf(withMeta({ name: 7 }))).toContain("invalid_name");
    });

    it("invalid_description: rejects over-long descriptions", () => {
        expect(errorsOf(withMeta({ description: "x".repeat(301) }))).toContain(
            "invalid_description",
        );
        expect(errorsOf(withMeta({ description: 12 }))).toContain(
            "invalid_description",
        );
    });

    it("invalid_players: rejects out-of-range and min > max", () => {
        expect(errorsOf(withMeta({ minPlayers: 1 }))).toContain(
            "invalid_players",
        );
        expect(errorsOf(withMeta({ maxPlayers: 9 }))).toContain(
            "invalid_players",
        );
        expect(errorsOf(withMeta({ minPlayers: 4, maxPlayers: 3 }))).toContain(
            "invalid_players",
        );
        expect(errorsOf(withMeta({ minPlayers: 2.5 }))).toContain(
            "invalid_players",
        );
    });
});

describe("validateEcaDefinition — setup & turn", () => {
    it("invalid_deck: rejects decks outside the v1 whitelist", () => {
        expect(errorsOf(withSetup({ deckId: "tarot78" }))).toContain(
            "invalid_deck",
        );
        expect(errorsOf(withSetup({ deckId: "uno" }))).toContain(
            "invalid_deck",
        );
    });

    it("invalid_hand_size: rejects out-of-bounds sizes", () => {
        expect(errorsOf(withSetup({ handSize: 0 }))).toContain(
            "invalid_hand_size",
        );
        expect(errorsOf(withSetup({ handSize: 27 }))).toContain(
            "invalid_hand_size",
        );
    });

    it("invalid_hand_size: rejects a deal that does not fit the deck", () => {
        // french32: 9 cards × 4 players = 36 > 32.
        expect(errorsOf(withSetup({ handSize: 9 }))).toContain(
            "invalid_hand_size",
        );
        // 8 × 4 = 32 fits exactly…
        expect(validateEcaDefinition(withSetup({ handSize: 8 })).ok).toBe(true);
        // …but not with a start discard on top.
        expect(
            errorsOf(withSetup({ handSize: 8, startDiscard: true })),
        ).toContain("invalid_hand_size");
    });

    it("invalid_start_discard: rejects a non-boolean flag", () => {
        expect(errorsOf(withSetup({ startDiscard: "yes" }))).toContain(
            "invalid_start_discard",
        );
    });

    it("invalid_turn_flag: rejects non-boolean turn flags", () => {
        expect(
            errorsOf({ ...base, turn: { ...base.turn, allowDraw: 1 } }),
        ).toContain("invalid_turn_flag");
        expect(
            errorsOf({
                ...base,
                turn: { ...base.turn, reshuffleDiscard: undefined },
            }),
        ).toContain("invalid_turn_flag");
    });
});

describe("validateEcaDefinition — rules", () => {
    it("invalid_rules: rejects a non-array, an empty list and > 32 rules", () => {
        expect(errorsOf(withRules("nope"))).toContain("invalid_rules");
        expect(errorsOf(withRules([]))).toContain("invalid_rules");
        expect(
            errorsOf(
                withRules(
                    Array.from({ length: 33 }, (_, i) => ({
                        ...baseRule,
                        id: `rule-${i}`,
                    })),
                ),
            ),
        ).toContain("invalid_rules");
    });

    it("invalid_rule: rejects a non-object rule", () => {
        expect(errorsOf(withRules([baseRule, "junk"]))).toContain(
            "invalid_rule",
        );
    });

    it("invalid_rule_id: rejects empty or missing ids", () => {
        expect(errorsOf(withRules([{ ...baseRule, id: "" }]))).toContain(
            "invalid_rule_id",
        );
        expect(errorsOf(withRules([{ ...baseRule, id: 4 }]))).toContain(
            "invalid_rule_id",
        );
    });

    it("duplicate_rule_id: rejects two rules sharing an id", () => {
        expect(
            errorsOf(withRules([baseRule, { ...baseRule, name: "bis" }])),
        ).toContain("duplicate_rule_id");
    });

    it("invalid_rule_name: rejects empty and over-long names", () => {
        expect(errorsOf(withRules([{ ...baseRule, name: "" }]))).toContain(
            "invalid_rule_name",
        );
        expect(
            errorsOf(withRules([{ ...baseRule, name: "x".repeat(61) }])),
        ).toContain("invalid_rule_name");
    });

    it("invalid_event: rejects unknown events", () => {
        expect(
            errorsOf(withRules([{ ...baseRule, event: "cardDrawn" }])),
        ).toContain("invalid_event");
    });

    it("no_accepting_rule: rejects a game where no card is ever playable", () => {
        expect(
            errorsOf(
                withRules([
                    {
                        ...baseRule,
                        effects: [{ type: "rejectCard" }],
                    },
                ]),
            ),
        ).toContain("no_accepting_rule");
    });
});

describe("validateEcaDefinition — conditions", () => {
    const conditioned = (conditions: unknown): unknown =>
        withRules([{ ...baseRule, conditions }]);

    it("invalid_conditions: rejects a non-array", () => {
        expect(errorsOf(conditioned("nope"))).toContain("invalid_conditions");
    });

    it("invalid_condition: rejects a non-object condition", () => {
        expect(errorsOf(conditioned([42]))).toContain("invalid_condition");
    });

    it("too_many_conditions: accepts 8 conditions, rejects 9", () => {
        const condition = {
            lhs: { kind: "stat", source: "actorHandCount" },
            op: "eq",
            rhs: { kind: "literal", value: 1 },
        };
        expect(
            validateEcaDefinition(
                conditioned(Array.from({ length: 8 }, () => condition)),
            ).ok,
        ).toBe(true);
        const result = validateEcaDefinition(
            conditioned(Array.from({ length: 9 }, () => condition)),
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors).toContainEqual({
                path: "rules[0].conditions",
                code: "too_many_conditions",
                message:
                    "Rule conditions must be an array of at most 8 conditions.",
            });
        }
    });

    it("invalid_operand: rejects unknown kinds, sources, props and values", () => {
        const rhs = { kind: "literal", value: "8" };
        expect(
            errorsOf(conditioned([{ lhs: { kind: "dice" }, op: "eq", rhs }])),
        ).toContain("invalid_operand");
        expect(
            errorsOf(
                conditioned([
                    {
                        lhs: { kind: "card", source: "handCard", prop: "rank" },
                        op: "eq",
                        rhs,
                    },
                ]),
            ),
        ).toContain("invalid_operand");
        expect(
            errorsOf(
                conditioned([
                    {
                        lhs: {
                            kind: "card",
                            source: "topDiscard",
                            prop: "color",
                        },
                        op: "eq",
                        rhs,
                    },
                ]),
            ),
        ).toContain("invalid_operand");
        expect(
            errorsOf(
                conditioned([
                    { lhs: { kind: "stat", source: "elo" }, op: "eq", rhs },
                ]),
            ),
        ).toContain("invalid_operand");
        expect(
            errorsOf(
                conditioned([
                    {
                        lhs: { kind: "literal", value: Number.NaN },
                        op: "eq",
                        rhs,
                    },
                ]),
            ),
        ).toContain("invalid_operand");
    });

    it("invalid_comparator: rejects unknown comparators", () => {
        expect(
            errorsOf(
                conditioned([
                    {
                        lhs: { kind: "literal", value: 1 },
                        op: "contains",
                        rhs: { kind: "literal", value: 1 },
                    },
                ]),
            ),
        ).toContain("invalid_comparator");
    });

    it("non_numeric_comparison: rejects gt/lt over string operands", () => {
        expect(
            errorsOf(
                conditioned([
                    {
                        lhs: {
                            kind: "card",
                            source: "playedCard",
                            prop: "rank",
                        },
                        op: "gt",
                        rhs: { kind: "literal", value: "7" },
                    },
                ]),
            ),
        ).toContain("non_numeric_comparison");
    });

    it("played_card_scope: forbids playedCard operands in turnStarted rules", () => {
        expect(
            errorsOf(
                withRules([
                    baseRule,
                    {
                        id: "turn-rule",
                        name: "hors sujet",
                        event: "turnStarted",
                        conditions: [
                            {
                                lhs: {
                                    kind: "card",
                                    source: "playedCard",
                                    prop: "rank",
                                },
                                op: "eq",
                                rhs: { kind: "literal", value: "8" },
                            },
                        ],
                        effects: [{ type: "skipNextPlayer" }],
                    },
                ]),
            ),
        ).toContain("played_card_scope");
    });
});

describe("validateEcaDefinition — effects", () => {
    const effected = (effects: unknown): unknown =>
        withRules([{ ...baseRule, effects }]);

    it("invalid_effects: rejects a non-array, an empty list and > 8 effects", () => {
        expect(errorsOf(effected("nope"))).toContain("invalid_effects");
        expect(errorsOf(effected([]))).toContain("invalid_effects");
        expect(
            errorsOf(
                effected(
                    Array.from({ length: 9 }, () => ({ type: "acceptCard" })),
                ),
            ),
        ).toContain("invalid_effects");
    });

    it("invalid_effect: rejects unknown effect types", () => {
        expect(errorsOf(effected([{ type: "explode" }]))).toContain(
            "invalid_effect",
        );
        expect(errorsOf(effected([null]))).toContain("invalid_effect");
    });

    it("effect_event_mismatch: forbids accept/reject/playAgain in turnStarted", () => {
        for (const type of ["acceptCard", "rejectCard", "playAgain"]) {
            const codes = errorsOf(
                withRules([
                    baseRule,
                    {
                        id: "turn-rule",
                        name: "interdit",
                        event: "turnStarted",
                        conditions: [],
                        effects: [{ type }],
                    },
                ]),
            );
            expect(codes).toContain("effect_event_mismatch");
        }
    });

    it("invalid_draw_target: rejects unknown drawCards targets", () => {
        expect(
            errorsOf(
                effected([{ type: "drawCards", target: "everyone", count: 2 }]),
            ),
        ).toContain("invalid_draw_target");
    });

    it("invalid_draw_count: rejects counts outside 1..8", () => {
        expect(
            errorsOf(
                effected([{ type: "drawCards", target: "actor", count: 0 }]),
            ),
        ).toContain("invalid_draw_count");
        expect(
            errorsOf(
                effected([{ type: "drawCards", target: "actor", count: 9 }]),
            ),
        ).toContain("invalid_draw_count");
        expect(
            errorsOf(
                effected([{ type: "drawCards", target: "actor", count: 1.5 }]),
            ),
        ).toContain("invalid_draw_count");
    });

    it("invalid_winner: rejects endGame winners other than the actor", () => {
        expect(
            errorsOf(effected([{ type: "endGame", winner: "dealer" }])),
        ).toContain("invalid_winner");
    });
});

describe("validateEcaDefinition — win", () => {
    it("invalid_win: rejects anything but emptyHand", () => {
        expect(errorsOf({ ...base, win: { condition: "score" } })).toContain(
            "invalid_win",
        );
        expect(errorsOf({ ...base, win: null })).toContain("invalid_win");
    });
});
