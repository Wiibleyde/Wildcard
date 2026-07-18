import type { CardDescriptor, Rank } from "@/lib/card/types";
import type {
    EcaCondition,
    EcaEventType,
    EcaOperand,
    EcaRule,
    EcaState,
} from "./types";

/**
 * Pure evaluation core of the ECA engine: operands → values, conditions →
 * booleans, rules → first/all matches. No state mutation lives here — the
 * module (`module.ts`) owns effects and turn flow; the Studio editor reuses
 * these helpers for live rule previews, and tests exercise them directly.
 */

/** Everything a condition may look at when a rule is evaluated. */
export interface EcaRuleContext {
    /** The card being played — `null` outside cardPlayed rules. */
    readonly playedCard: CardDescriptor | null;
    /** Top of the discard pile — `null` while the pile is empty. */
    readonly topDiscard: CardDescriptor | null;
    readonly actorHandCount: number;
    readonly drawPileCount: number;
    readonly discardPileCount: number;
    /** The deck's rank list, low → high — the `value` prop indexes into it. */
    readonly deckRanks: readonly Rank[];
}

/**
 * Numeric strength of a card: the index of its rank in the deck's rank list
 * (low → high). `null` for non-suited cards — unreachable with v1 decks, but
 * kept total so the interpreter never throws on data.
 */
export function cardRankValue(
    card: CardDescriptor,
    deckRanks: readonly Rank[],
): number | null {
    if (card.type !== "suited") return null;
    const index = deckRanks.indexOf(card.rank);
    return index === -1 ? null : index;
}

/**
 * Evaluate one operand against the context. `null` means "no value" — a
 * missing card (empty discard, no played card) or an unknown rank. A
 * condition over a `null` operand is simply false (see
 * {@link evaluateCondition}): missing data never satisfies a rule.
 */
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

/**
 * Evaluate one condition. Semantics:
 * - either side `null` (missing card / unknown rank) ⇒ **false** — a rule
 *   never fires on missing data, whatever the comparator;
 * - `eq`/`neq`: strict equality — `"7"` (rank) and `7` (number) are NOT equal;
 * - `gt`/`gte`/`lt`/`lte`: both sides must be numbers (the validator already
 *   guarantees numeric operand kinds; this is the runtime backstop).
 */
export function evaluateCondition(
    condition: EcaCondition,
    ctx: EcaRuleContext,
): boolean {
    const lhs = evaluateOperand(condition.lhs, ctx);
    const rhs = evaluateOperand(condition.rhs, ctx);
    if (lhs === null || rhs === null) return false;

    switch (condition.op) {
        case "eq":
            return lhs === rhs;
        case "neq":
            return lhs !== rhs;
        case "gt":
        case "gte":
        case "lt":
        case "lte": {
            if (typeof lhs !== "number" || typeof rhs !== "number") {
                return false;
            }
            switch (condition.op) {
                case "gt":
                    return lhs > rhs;
                case "gte":
                    return lhs >= rhs;
                case "lt":
                    return lhs < rhs;
                case "lte":
                    return lhs <= rhs;
            }
        }
    }
}

/** Whether every condition of `rule` passes (empty list ⇒ always matches). */
export function ruleMatches(rule: EcaRule, ctx: EcaRuleContext): boolean {
    return rule.conditions.every((condition) =>
        evaluateCondition(condition, ctx),
    );
}

/**
 * The first rule for `event` whose conditions all pass — array order is the
 * priority order (first match wins), which is what the editor surfaces with
 * its "1er / 2e / …" badges.
 */
export function firstMatchingRule(
    rules: readonly EcaRule[],
    event: EcaEventType,
    ctx: EcaRuleContext,
): EcaRule | null {
    for (const rule of rules) {
        if (rule.event === event && ruleMatches(rule, ctx)) return rule;
    }
    return null;
}

/** ALL matching rules for `event`, in array order — turnStarted fires each. */
export function matchingRules(
    rules: readonly EcaRule[],
    event: EcaEventType,
    ctx: EcaRuleContext,
): EcaRule[] {
    return rules.filter(
        (rule) => rule.event === event && ruleMatches(rule, ctx),
    );
}

/** Whether `rule` carries an effect of the given type. */
export function ruleHasEffect(
    rule: EcaRule,
    type: EcaRule["effects"][number]["type"],
): boolean {
    return rule.effects.some((effect) => effect.type === type);
}

/** Top of the discard pile (last element), or `null` when empty. */
export function topOfDiscard(
    discardPile: readonly CardDescriptor[],
): CardDescriptor | null {
    return discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
}

/**
 * Build the rule context for `actorId` out of a live state — shared by
 * `legalActions`, `apply` and the Studio preview so legality can never drift
 * between the hint path and the enforcement path.
 */
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
