import type {
    EcaCondition,
    EcaDefinition,
    EcaEffect,
    EcaEventType,
} from "@/lib/eca";

/**
 * Editor-side mirror of an {@link EcaDefinition}: conditions and effects carry
 * a local `key` so list rows get stable React keys (no array indexes) without
 * losing focus on every edit. The schema itself has no such ids — but
 * `validateEcaDefinition` REBUILDS the definition field by field, stripping
 * unknown keys, so a draft can be fed to it directly and the returned
 * definition is clean for saving and test play.
 *
 * Initial keys are position-derived (deterministic, so SSR and hydration
 * agree); rows added afterwards — always in response to a user event, thus
 * client-only — use `crypto.randomUUID()`.
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
