import { DECKS } from "@/lib/card/decks";
import type {
    EcaComparator,
    EcaCondition,
    EcaDeckId,
    EcaEffect,
    EcaEventType,
    EcaOperand,
} from "./types";

/** Suited-only decks: every card has a rank and a suit. */
export const ECA_DECK_IDS = ["french52", "french32"] as const;
export const ECA_EVENT_TYPES = ["cardPlayed", "turnStarted"] as const;
export const ECA_CARD_SOURCES = ["playedCard", "topDiscard"] as const;
export const ECA_CARD_PROPS = ["rank", "suit", "value"] as const;
export const ECA_STAT_SOURCES = [
    "actorHandCount",
    "drawPileCount",
    "discardPileCount",
] as const;
export const ECA_COMPARATORS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export const ECA_EQUALITY_COMPARATORS = [
    "eq",
    "neq",
] as const satisfies readonly EcaComparator[];
export const ECA_DRAW_TARGETS = ["actor", "nextPlayer"] as const;
export const ECA_EFFECT_TYPES = [
    "acceptCard",
    "rejectCard",
    "drawCards",
    "skipNextPlayer",
    "reverseDirection",
    "playAgain",
    "endGame",
] as const;

export type EcaEffectType = (typeof ECA_EFFECT_TYPES)[number];

interface EffectSpec<T extends EcaEffectType> {
    /** Only meaningful as a response to a played card. */
    readonly cardPlayedOnly: boolean;
    readonly create: () => Extract<EcaEffect, { type: T }>;
}

export const ECA_EFFECT_SPECS: {
    readonly [T in EcaEffectType]: EffectSpec<T>;
} = {
    acceptCard: {
        cardPlayedOnly: true,
        create: () => ({ type: "acceptCard" }),
    },
    rejectCard: {
        cardPlayedOnly: true,
        create: () => ({ type: "rejectCard" }),
    },
    drawCards: {
        cardPlayedOnly: false,
        create: () => ({ type: "drawCards", target: "nextPlayer", count: 1 }),
    },
    skipNextPlayer: {
        cardPlayedOnly: false,
        create: () => ({ type: "skipNextPlayer" }),
    },
    reverseDirection: {
        cardPlayedOnly: false,
        create: () => ({ type: "reverseDirection" }),
    },
    playAgain: {
        cardPlayedOnly: true,
        create: () => ({ type: "playAgain" }),
    },
    endGame: {
        cardPlayedOnly: false,
        create: () => ({ type: "endGame", winner: "actor" }),
    },
};

export function effectTypesFor(event: EcaEventType): readonly EcaEffectType[] {
    return event === "cardPlayed"
        ? ECA_EFFECT_TYPES
        : ECA_EFFECT_TYPES.filter(
              (type) => !ECA_EFFECT_SPECS[type].cardPlayedOnly,
          );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOneOf<T extends string>(
    value: unknown,
    options: readonly T[],
): value is T {
    return (
        typeof value === "string" &&
        (options as readonly string[]).includes(value)
    );
}

// ── Operand domains ──────────────────────────────────────────────────────────

export type EcaOperandDomain = "rank" | "suit" | "number";

/** What an operand evaluates to; `null` for a literal (it takes its counterpart's domain). */
export function operandDomain(operand: EcaOperand): EcaOperandDomain | null {
    switch (operand.kind) {
        case "card":
            return operand.prop === "value" ? "number" : operand.prop;
        case "stat":
            return "number";
        case "literal":
            return null;
    }
}

export function isNumericOperand(operand: EcaOperand): boolean {
    return operand.kind === "literal"
        ? typeof operand.value === "number"
        : operandDomain(operand) === "number";
}

/** Order comparisons need numbers on both sides; ranks and suits only compare for equality. */
export function comparatorsFor(
    lhs: EcaOperand,
    rhs: EcaOperand,
): readonly EcaComparator[] {
    return isNumericOperand(lhs) && isNumericOperand(rhs)
        ? ECA_COMPARATORS
        : ECA_EQUALITY_COMPARATORS;
}

/** Whether a literal is a value of `domain` in this deck (else the condition can never match). */
export function literalFitsDomain(
    value: string | number,
    domain: EcaOperandDomain,
    deckId: EcaDeckId,
): boolean {
    const deck = DECKS[deckId];
    switch (domain) {
        case "rank":
            return (deck.ranks as readonly (string | number)[]).includes(value);
        case "suit":
            return (deck.suits as readonly (string | number)[]).includes(value);
        case "number":
            return typeof value === "number";
    }
}

export function defaultLiteral(
    domain: EcaOperandDomain,
    deckId: EcaDeckId,
): string | number {
    switch (domain) {
        case "rank":
            return DECKS[deckId].ranks[0];
        case "suit":
            return DECKS[deckId].suits[0];
        case "number":
            return 0;
    }
}

/** The literal editor shape a counterpart demands (a literal counterpart reads as a number). */
export function literalDomainFor(counterpart: EcaOperand): EcaOperandDomain {
    return operandDomain(counterpart) ?? "number";
}

/** Coerce `literal` to its counterpart's domain when it no longer fits (side or deck changed). */
export function reconcileLiteral(
    counterpart: EcaOperand,
    literal: EcaOperand,
    deckId: EcaDeckId,
): EcaOperand {
    if (literal.kind !== "literal") return literal;
    const domain = literalDomainFor(counterpart);
    return literalFitsDomain(literal.value, domain, deckId)
        ? literal
        : { kind: "literal", value: defaultLiteral(domain, deckId) };
}

/** Re-fit both literals and the comparator after an operand or deck change. */
export function reconcileCondition<C extends EcaCondition>(
    condition: C,
    deckId: EcaDeckId,
): C {
    const lhs = reconcileLiteral(condition.rhs, condition.lhs, deckId);
    const rhs = reconcileLiteral(condition.lhs, condition.rhs, deckId);
    const op = comparatorsFor(lhs, rhs).includes(condition.op)
        ? condition.op
        : "eq";
    return { ...condition, lhs, rhs, op };
}
