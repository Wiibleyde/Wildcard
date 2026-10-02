import type { CardDescriptor, Rank } from "@/lib/card/types";
import type { EcaEffectType } from "./schema";
import type {
    EcaComparator,
    EcaCondition,
    EcaEventType,
    EcaOperand,
    EcaRule,
    EcaState,
} from "./types";

/** Pure evaluation core: no mutation here, `module.ts` owns effects and turn flow. */

export interface EcaRuleContext {
    /** `null` outside cardPlayed rules. */
    readonly playedCard: CardDescriptor | null;
    readonly topDiscard: CardDescriptor | null;
    /** For cardPlayed rules the played card is still in hand. */
    readonly actorHandCount: number;
    readonly drawPileCount: number;
    readonly discardPileCount: number;
    /** Low → high; the `value` prop indexes into it. */
    readonly deckRanks: readonly Rank[];
}

export function cardRankValue(
    card: CardDescriptor,
    deckRanks: readonly Rank[],
): number | null {
    if (card.type !== "suited") return null;
    const index = deckRanks.indexOf(card.rank);
    return index === -1 ? null : index;
}

/** `null` = no value (missing card, unknown rank): a condition over it is false. */
export function evaluateOperand(
    operand: EcaOperand,
    ctx: EcaRuleContext,
): string | number | null {
    switch (operand.kind) {
        case "card": {
            const card =
                operand.source === "playedCard"
                    ? ctx.playedCard
                    : ctx.topDiscard;
            if (card === null || card.type !== "suited") return null;
            switch (operand.prop) {
                case "rank":
                    return card.rank;
                case "suit":
                    return card.suit;
                case "value":
                    return cardRankValue(card, ctx.deckRanks);
            }
            break;
        }
        case "stat":
            switch (operand.source) {
                case "actorHandCount":
                    return ctx.actorHandCount;
                case "drawPileCount":
                    return ctx.drawPileCount;
                case "discardPileCount":
                    return ctx.discardPileCount;
            }
            break;
        case "literal":
            return operand.value;
    }
    return null;
}

type Value = string | number;

function numeric(
    compare: (a: number, b: number) => boolean,
): (a: Value, b: Value) => boolean {
    // Runtime backstop: the validator already rejects order comparisons on strings.
    return (a, b) =>
        typeof a === "number" && typeof b === "number" && compare(a, b);
}

/** Strict equality: the rank `"7"` never equals the number `7`. */
const COMPARE: Record<EcaComparator, (a: Value, b: Value) => boolean> = {
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b,
    gt: numeric((a, b) => a > b),
    gte: numeric((a, b) => a >= b),
    lt: numeric((a, b) => a < b),
    lte: numeric((a, b) => a <= b),
};

export function evaluateCondition(
    condition: EcaCondition,
    ctx: EcaRuleContext,
): boolean {
    const lhs = evaluateOperand(condition.lhs, ctx);
    const rhs = evaluateOperand(condition.rhs, ctx);
    if (lhs === null || rhs === null) return false;
    return COMPARE[condition.op](lhs, rhs);
}

export function ruleMatches(rule: EcaRule, ctx: EcaRuleContext): boolean {
    return rule.conditions.every((condition) =>
        evaluateCondition(condition, ctx),
    );
}

export function firstMatchingRule(
    rules: readonly EcaRule[],
    event: EcaEventType,
    ctx: EcaRuleContext,
): EcaRule | null {
    return (
        rules.find((rule) => rule.event === event && ruleMatches(rule, ctx)) ??
        null
    );
}

export function ruleHasEffect(rule: EcaRule, type: EcaEffectType): boolean {
    return rule.effects.some((effect) => effect.type === type);
}

export function topOfDiscard(
    discardPile: readonly CardDescriptor[],
): CardDescriptor | null {
    return discardPile.at(-1) ?? null;
}

/** Shared by `legalActions` and `apply` so hints and enforcement never drift. */
export function buildRuleContext(
    state: Pick<EcaState, "hands" | "drawPile" | "discardPile">,
    actorId: string,
    playedCard: CardDescriptor | null,
    deckRanks: readonly Rank[],
): EcaRuleContext {
    return {
        playedCard,
        topDiscard: topOfDiscard(state.discardPile),
        actorHandCount: state.hands[actorId]?.length ?? 0,
        drawPileCount: state.drawPile.length,
        discardPileCount: state.discardPile.length,
        deckRanks,
    };
}
