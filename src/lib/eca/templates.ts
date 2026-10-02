import type { EcaCondition, EcaDefinition, EcaOperand } from "./types";

/** Studio "new game" templates; display strings come from the `studio` namespace. */

export const ECA_TEMPLATE_IDS = ["blank", "example"] as const;
export type EcaTemplateId = (typeof ECA_TEMPLATE_IDS)[number];

type EcaTemplateKey =
    | "template_blank_name"
    | "template_blank_rule"
    | "template_example_name"
    | "template_example_description"
    | "template_example_rule_wild_eight"
    | "template_example_rule_ace_suit"
    | "template_example_rule_ace_rank"
    | "template_example_rule_seven_suit"
    | "template_example_rule_seven_rank"
    | "template_example_rule_same_suit"
    | "template_example_rule_same_rank";

export type EcaTemplateText = (key: EcaTemplateKey) => string;

const played = (prop: "rank" | "suit"): EcaOperand => ({
    kind: "card",
    source: "playedCard",
    prop,
});
const top = (prop: "rank" | "suit"): EcaOperand => ({
    kind: "card",
    source: "topDiscard",
    prop,
});
const rankIs = (rank: string): EcaCondition => ({
    lhs: played("rank"),
    op: "eq",
    rhs: { kind: "literal", value: rank },
});
const suitMatches: EcaCondition = {
    lhs: played("suit"),
    op: "eq",
    rhs: top("suit"),
};
const rankMatches: EcaCondition = {
    lhs: played("rank"),
    op: "eq",
    rhs: top("rank"),
};

function blank(text: EcaTemplateText): EcaDefinition {
    return {
        version: 1,
        meta: {
            name: text("template_blank_name"),
            minPlayers: 2,
            maxPlayers: 4,
        },
        setup: { deckId: "french32", handSize: 5, startDiscard: false },
        turn: {
            allowDraw: false,
            allowPass: false,
            passRequiresDraw: false,
            reshuffleDiscard: false,
        },
        rules: [
            {
                id: "accept-anything",
                name: text("template_blank_rule"),
                event: "cardPlayed",
                conditions: [],
                effects: [{ type: "acceptCard" }],
            },
        ],
        win: { condition: "emptyHand" },
    };
}

/** Crazy Eights. Specials sit above the plain suit/rank rules, which would otherwise shadow them. */
function example(text: EcaTemplateText): EcaDefinition {
    return {
        version: 1,
        meta: {
            name: text("template_example_name"),
            description: text("template_example_description"),
            minPlayers: 2,
            maxPlayers: 5,
        },
        setup: { deckId: "french52", handSize: 7, startDiscard: true },
        turn: {
            allowDraw: true,
            allowPass: true,
            passRequiresDraw: true,
            reshuffleDiscard: true,
        },
        rules: [
            {
                id: "wild-eight",
                name: text("template_example_rule_wild_eight"),
                event: "cardPlayed",
                conditions: [rankIs("8")],
                effects: [{ type: "acceptCard" }],
            },
            {
                id: "ace-suit-reverses",
                name: text("template_example_rule_ace_suit"),
                event: "cardPlayed",
                conditions: [rankIs("A"), suitMatches],
                effects: [{ type: "acceptCard" }, { type: "reverseDirection" }],
            },
            {
                id: "ace-rank-reverses",
                name: text("template_example_rule_ace_rank"),
                event: "cardPlayed",
                conditions: [rankIs("A"), rankMatches],
                effects: [{ type: "acceptCard" }, { type: "reverseDirection" }],
            },
            {
                id: "seven-suit-skips",
                name: text("template_example_rule_seven_suit"),
                event: "cardPlayed",
                conditions: [rankIs("7"), suitMatches],
                effects: [{ type: "acceptCard" }, { type: "skipNextPlayer" }],
            },
            {
                id: "seven-rank-skips",
                name: text("template_example_rule_seven_rank"),
                event: "cardPlayed",
                conditions: [rankIs("7"), rankMatches],
                effects: [{ type: "acceptCard" }, { type: "skipNextPlayer" }],
            },
            {
                id: "same-suit",
                name: text("template_example_rule_same_suit"),
                event: "cardPlayed",
                conditions: [suitMatches],
                effects: [{ type: "acceptCard" }],
            },
            {
                id: "same-rank",
                name: text("template_example_rule_same_rank"),
                event: "cardPlayed",
                conditions: [rankMatches],
                effects: [{ type: "acceptCard" }],
            },
        ],
        win: { condition: "emptyHand" },
    };
}

const BUILDERS: Record<
    EcaTemplateId,
    (text: EcaTemplateText) => EcaDefinition
> = { blank, example };

export function ecaTemplate(
    id: EcaTemplateId,
    text: EcaTemplateText,
): EcaDefinition {
    return BUILDERS[id](text);
}
