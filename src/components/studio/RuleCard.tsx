"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { Input } from "@/components/nb/input";
import { SelectField } from "@/components/ui/SelectField";
import { ECA_EFFECT_SPECS, ECA_EVENT_TYPES, isOneOf } from "@/lib/eca/schema";
import type {
    EcaCondition,
    EcaDeckId,
    EcaEffect,
    EcaEventType,
    EcaOperand,
} from "@/lib/eca/types";
import { ECA_EFFECTS_MAX, ECA_RULE_NAME_MAX } from "@/lib/eca/validate";
import { ConditionRow } from "./ConditionRow";
import type { DraftCondition, DraftEffect, DraftRule } from "./draft";
import { EffectRow } from "./EffectRow";
import {
    dangerButtonStyle,
    fieldClass,
    labelClass,
    labelStyle,
    mutedTextStyle,
    squareButtonClass,
    squareButtonStyle,
} from "./fields";
import type { StudioMessageKey } from "./messages";

const EVENTS: Record<
    EcaEventType,
    {
        readonly label: StudioMessageKey;
        readonly short: StudioMessageKey;
        readonly stamp: CSSProperties;
    }
> = {
    cardPlayed: {
        label: "event_cardPlayed",
        short: "event_cardPlayed_short",
        stamp: { background: "var(--gold)", color: "var(--ink)" },
    },
    turnStarted: {
        label: "event_turnStarted",
        short: "event_turnStarted_short",
        stamp: { background: "var(--blue)", color: "var(--accent-ink)" },
    },
};

const addButtonClass =
    "wc-chip self-start rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40";

function usesPlayedCard(operand: EcaOperand): boolean {
    return operand.kind === "card" && operand.source === "playedCard";
}

function starterCondition(event: EcaEventType): EcaCondition {
    return event === "cardPlayed"
        ? {
              lhs: { kind: "card", source: "playedCard", prop: "suit" },
              op: "eq",
              rhs: { kind: "card", source: "topDiscard", prop: "suit" },
          }
        : {
              lhs: { kind: "stat", source: "drawPileCount" },
              op: "eq",
              rhs: { kind: "literal", value: 0 },
          };
}

function starterEffect(event: EcaEventType): EcaEffect {
    return event === "cardPlayed"
        ? { type: "acceptCard" }
        : { type: "drawCards", target: "actor", count: 1 };
}

interface Props {
    readonly rule: DraftRule;
    readonly index: number;
    readonly total: number;
    readonly deckId: EcaDeckId;
    readonly onChange: (rule: DraftRule) => void;
    readonly onMove: (delta: -1 | 1) => void;
    readonly onRemove: () => void;
}

export function RuleCard({
    rule,
    index,
    total,
    deckId,
    onChange,
    onMove,
    onRemove,
}: Props) {
    const t = useTranslations("studio");

    /** turnStarted silently drops what cannot exist there instead of piling up errors. */
    function switchEvent(next: string) {
        if (!isOneOf(next, ECA_EVENT_TYPES) || next === rule.event) return;
        if (next === "cardPlayed") {
            onChange({ ...rule, event: next });
            return;
        }
        const conditions = rule.conditions.filter(
            (c) => !usesPlayedCard(c.lhs) && !usesPlayedCard(c.rhs),
        );
        const effects = rule.effects.filter(
            (e) => !ECA_EFFECT_SPECS[e.type].cardPlayedOnly,
        );
        onChange({
            ...rule,
            event: next,
            conditions,
            effects:
                effects.length > 0
                    ? effects
                    : [{ ...starterEffect(next), key: crypto.randomUUID() }],
        });
    }

    function addCondition() {
        const condition: DraftCondition = {
            ...starterCondition(rule.event),
            key: crypto.randomUUID(),
        };
        onChange({ ...rule, conditions: [...rule.conditions, condition] });
    }

    function updateCondition(key: string, next: EcaCondition) {
        onChange({
            ...rule,
            conditions: rule.conditions.map((c) =>
                c.key === key ? { ...next, key } : c,
            ),
        });
    }

    function removeCondition(key: string) {
        onChange({
            ...rule,
            conditions: rule.conditions.filter((c) => c.key !== key),
        });
    }

    function addEffect() {
        if (rule.effects.length >= ECA_EFFECTS_MAX) return;
        const effect: DraftEffect = {
            ...starterEffect(rule.event),
            key: crypto.randomUUID(),
        };
        onChange({ ...rule, effects: [...rule.effects, effect] });
    }

    function updateEffect(key: string, next: EcaEffect) {
        onChange({
            ...rule,
            effects: rule.effects.map((e) =>
                e.key === key ? { ...next, key } : e,
            ),
        });
    }

    function removeEffect(key: string) {
        if (rule.effects.length <= 1) return;
        onChange({
            ...rule,
            effects: rule.effects.filter((e) => e.key !== key),
        });
    }

    return (
        <article className="panel flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className="stamp"
                    style={{ background: "var(--cream2)", color: "var(--ink)" }}
                >
                    #{index + 1}
                </span>
                <Input
                    value={rule.name}
                    onChange={(e) =>
                        onChange({ ...rule, name: e.target.value })
                    }
                    maxLength={ECA_RULE_NAME_MAX}
                    aria-label={t("rule_name_label")}
                    placeholder={t("rule_default_name")}
                    className={`${fieldClass} min-w-36 flex-1`}
                />
                <span className="stamp" style={EVENTS[rule.event].stamp}>
                    {t(EVENTS[rule.event].short)}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={index === 0}
                        aria-label={t("move_up")}
                        className={squareButtonClass}
                        style={squareButtonStyle}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={index === total - 1}
                        aria-label={t("move_down")}
                        className={squareButtonClass}
                        style={squareButtonStyle}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label={t("remove_rule")}
                        className={squareButtonClass}
                        style={dangerButtonStyle}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <section className="flex flex-col gap-2">
                <p className={labelClass} style={labelStyle}>
                    {t("when_title")}
                </p>
                <SelectField
                    value={rule.event}
                    onChange={switchEvent}
                    ariaLabel={t("when_title")}
                    className={fieldClass}
                    options={ECA_EVENT_TYPES.map((event) => ({
                        value: event,
                        label: t(EVENTS[event].label),
                    }))}
                />
            </section>

            <section className="flex flex-col gap-2">
                <p className={labelClass} style={labelStyle}>
                    {t("if_title")}
                </p>
                {rule.conditions.length === 0 && (
                    <p className="text-xs font-semibold" style={mutedTextStyle}>
                        {t("conditions_empty")}
                    </p>
                )}
                {rule.conditions.map((condition) => (
                    <ConditionRow
                        key={condition.key}
                        condition={condition}
                        event={rule.event}
                        deckId={deckId}
                        onChange={(next) =>
                            updateCondition(condition.key, next)
                        }
                        onRemove={() => removeCondition(condition.key)}
                    />
                ))}
                <button
                    type="button"
                    onClick={addCondition}
                    className={addButtonClass}
                    style={squareButtonStyle}
                >
                    + {t("add_condition")}
                </button>
            </section>

            <section className="flex flex-col gap-2">
                <p className={labelClass} style={labelStyle}>
                    {t("then_title")}
                </p>
                {rule.effects.map((effect) => (
                    <EffectRow
                        key={effect.key}
                        effect={effect}
                        event={rule.event}
                        onChange={(next) => updateEffect(effect.key, next)}
                        onRemove={() => removeEffect(effect.key)}
                        removable={rule.effects.length > 1}
                    />
                ))}
                <button
                    type="button"
                    onClick={addEffect}
                    disabled={rule.effects.length >= ECA_EFFECTS_MAX}
                    className={addButtonClass}
                    style={squareButtonStyle}
                >
                    + {t("add_effect")}
                </button>
            </section>
        </article>
    );
}
