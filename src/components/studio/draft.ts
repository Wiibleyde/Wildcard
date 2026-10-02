import type {
    EcaCondition,
    EcaDefinition,
    EcaEffect,
    EcaEventType,
} from "@/lib/eca/types";

/**
 * Editor mirror of a definition with stable row keys. The validator rebuilds
 * field by field, so the keys never reach the server. Initial keys are
 * positional so SSR and hydration agree.
 */

export type DraftCondition = EcaCondition & { readonly key: string };
export type DraftEffect = EcaEffect & { readonly key: string };

export interface DraftRule {
    readonly id: string;
    readonly name: string;
    readonly event: EcaEventType;
    readonly conditions: readonly DraftCondition[];
    readonly effects: readonly DraftEffect[];
}

export interface DraftDefinition {
    readonly version: 1;
    readonly meta: EcaDefinition["meta"];
    readonly setup: EcaDefinition["setup"];
    readonly turn: EcaDefinition["turn"];
    readonly rules: readonly DraftRule[];
    readonly win: EcaDefinition["win"];
}

export function toDraftDefinition(definition: EcaDefinition): DraftDefinition {
    return {
        ...definition,
        rules: definition.rules.map((rule, ruleIndex) => ({
            ...rule,
            conditions: rule.conditions.map((condition, i) => ({
                ...condition,
                key: `r${ruleIndex}-c${i}`,
            })),
            effects: rule.effects.map((effect, i) => ({
                ...effect,
                key: `r${ruleIndex}-e${i}`,
            })),
        })),
    };
}

export function newDraftRule(name: string): DraftRule {
    return {
        id: crypto.randomUUID(),
        name,
        event: "cardPlayed",
        conditions: [],
        effects: [{ type: "acceptCard", key: crypto.randomUUID() }],
    };
}
