"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { EcaDeckId } from "@/lib/eca/types";
import { ECA_RULES_MAX } from "@/lib/eca/validate";
import { type DraftRule, newDraftRule } from "./draft";
import { RuleCard } from "./RuleCard";

/**
 * The ordered rule stack. Order is the priority order — the first matching
 * rule wins — so reordering is a first-class edit, not cosmetics.
 */

interface Props {
    readonly rules: readonly DraftRule[];
    readonly deckId: EcaDeckId;
    readonly onChange: (rules: readonly DraftRule[]) => void;
}

export function RuleList({ rules, deckId, onChange }: Props) {
    const t = useTranslations("studio");

    function updateRule(id: string, next: DraftRule) {
        onChange(rules.map((rule) => (rule.id === id ? next : rule)));
    }

    function moveRule(id: string, delta: -1 | 1) {
        const index = rules.findIndex((rule) => rule.id === id);
        const target = index + delta;
        if (index === -1 || target < 0 || target >= rules.length) return;
        const next = [...rules];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    }

    function removeRule(id: string) {
        onChange(rules.filter((rule) => rule.id !== id));
    }

    function addRule() {
        if (rules.length >= ECA_RULES_MAX) return;
        onChange([...rules, newDraftRule(t("rule_default_name"))]);
    }

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="font-display text-xl text-wc-cream">
                    {t("editor_rules")}
                </h2>
                <p className="sub text-xs">{t("first_match_hint")}</p>
            </div>
            {rules.map((rule, index) => (
                <RuleCard
                    key={rule.id}
                    rule={rule}
                    index={index}
                    total={rules.length}
                    deckId={deckId}
                    onChange={(next) => updateRule(rule.id, next)}
                    onMove={(delta) => moveRule(rule.id, delta)}
                    onRemove={() => removeRule(rule.id)}
                />
            ))}
            <GameButton
                variant="gold"
                size="sm"
                onClick={addRule}
                disabled={rules.length >= ECA_RULES_MAX}
                className="self-start"
            >
                + {t("add_rule")}
            </GameButton>
        </section>
    );
}
