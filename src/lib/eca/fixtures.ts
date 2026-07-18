import type { EcaCondition, EcaDefinition, EcaOperand } from "./types";

/**
 * Reference ECA definitions — complete, valid documents used three ways:
 * - unit tests (validator + interpreter + module) run against them;
 * - the Studio offers them as "new game" templates (blank vs example);
 * - the jury demo plays CRAZY_EIGHTS_LIKE end to end.
 */

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
const topRank: EcaOperand = {
    kind: "card",
    source: "topDiscard",
    prop: "rank",
};
const topSuit: EcaOperand = {
    kind: "card",
    source: "topDiscard",
    prop: "suit",
};

const rankIs = (rank: string): EcaCondition => ({
    lhs: playedRank,
    op: "eq",
    rhs: { kind: "literal", value: rank },
});
const suitMatches: EcaCondition = { lhs: playedSuit, op: "eq", rhs: topSuit };
const rankMatches: EcaCondition = { lhs: playedRank, op: "eq", rhs: topRank };

/**
 * « Huit américain » (Crazy Eights) — the flagship example: a card is playable
 * when it shares the suit or the rank of the top discard; an 8 is wild; a 7
 * skips the next player; an Ace reverses direction.
 *
 * Rule order is load-bearing (first match wins): the 8/Ace/7 specials sit
 * ABOVE the plain suit/rank rules, otherwise the plain rules would shadow
 * them and the specials would never fire.
 */
export const CRAZY_EIGHTS_LIKE: EcaDefinition = {
    version: 1,
    meta: {
        name: "Huit américain",
        description:
            "Jouez une carte de la même couleur ou de la même valeur. " +
            "Le 8 est joker, le 7 fait sauter le joueur suivant, l'As inverse le sens.",
        minPlayers: 2,
        maxPlayers: 5,
    },
    setup: {
        deckId: "french52",
        handSize: 7,
        startDiscard: true,
    },
    turn: {
        allowDraw: true,
        allowPass: true,
        passRequiresDraw: true,
        reshuffleDiscard: true,
    },
    rules: [
        {
            id: "wild-eight",
            name: "8 — carte folle",
            event: "cardPlayed",
            conditions: [rankIs("8")],
            effects: [{ type: "acceptCard" }],
        },
        {
            id: "ace-suit-reverses",
            name: "As (couleur) — inverse le sens",
            event: "cardPlayed",
            conditions: [rankIs("A"), suitMatches],
            effects: [{ type: "acceptCard" }, { type: "reverseDirection" }],
        },
        {
            id: "ace-rank-reverses",
            name: "As sur As — inverse le sens",
            event: "cardPlayed",
            conditions: [rankIs("A"), rankMatches],
            effects: [{ type: "acceptCard" }, { type: "reverseDirection" }],
        },
        {
            id: "seven-suit-skips",
            name: "7 (couleur) — saute le suivant",
            event: "cardPlayed",
            conditions: [rankIs("7"), suitMatches],
            effects: [{ type: "acceptCard" }, { type: "skipNextPlayer" }],
        },
        {
            id: "seven-rank-skips",
            name: "7 sur 7 — saute le suivant",
            event: "cardPlayed",
            conditions: [rankIs("7"), rankMatches],
            effects: [{ type: "acceptCard" }, { type: "skipNextPlayer" }],
        },
        {
            id: "same-suit",
            name: "Même couleur",
            event: "cardPlayed",
            conditions: [suitMatches],
            effects: [{ type: "acceptCard" }],
        },
        {
            id: "same-rank",
            name: "Même valeur",
            event: "cardPlayed",
            conditions: [rankMatches],
            effects: [{ type: "acceptCard" }],
        },
    ],
    win: { condition: "emptyHand" },
};

/**
 * The smallest valid definition — one rule that accepts everything. The
 * Studio's blank template: creators start here and sculpt restrictions in.
 */
export const MINIMAL_VALID: EcaDefinition = {
    version: 1,
    meta: {
        name: "Défausse libre",
        minPlayers: 2,
        maxPlayers: 4,
    },
    setup: {
        deckId: "french32",
        handSize: 5,
        startDiscard: false,
    },
    turn: {
        allowDraw: false,
        allowPass: false,
        passRequiresDraw: false,
        reshuffleDiscard: false,
    },
    rules: [
        {
            id: "accept-anything",
            name: "Tout est permis",
            event: "cardPlayed",
            conditions: [],
            effects: [{ type: "acceptCard" }],
        },
    ],
    win: { condition: "emptyHand" },
};
