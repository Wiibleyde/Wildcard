"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type {
    EcaCondition,
    EcaDeckId,
    EcaEffect,
    EcaEventType,
    EcaOperand,
} from "@/lib/eca";
import { ECA_EFFECTS_MAX, ECA_RULE_NAME_MAX } from "@/lib/eca";
import { ConditionRow } from "./ConditionRow";
import type { DraftCondition, DraftEffect, DraftRule } from "./draft";
import { EffectRow } from "./EffectRow";
import {
    dangerButtonStyle,
    fieldClass,
    fieldStyle,
    labelClass,
    labelStyle,
    squareButtonClass,
    squareButtonStyle,
} from "./fields";

/**
 * One editable rule: QUAND (event) / SI (conditions) / ALORS (effects), plus
 * ordering controls — order is load-bearing (first matching rule wins), which
 * the index stamp and the list-level hint make explicit.
 */

const EVENT_STAMP: Record<EcaEventType, CSSProperties> = {
    cardPlayed: { background: "var(--gold)", color: "var(--ink)" },
    turnStarted: { background: "var(--blue)", color: "var(--accent-ink)" },
};

function usesPlayedCard(operand: EcaOperand): boolean {
    return operand.kind === "card" && operand.source === "playedCard";
}

function defaultCondition(event: EcaEventType): EcaCondition {
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

function defaultEffect(event: EcaEventType): EcaEffect {
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

    /**
     * Switching to turnStarted quietly drops what cannot exist there
     * (playedCard operands; accept/reject/playAgain effects) instead of
     * leaving the creator a pile of validation errors.
     */
    function switchEvent(next: string) {
        if (next !== "cardPlayed" && next !== "turnStarted") return;
        if (next === rule.event) return;
        if (next === "cardPlayed") {
            onChange({ ...rule, event: next });
            return;
        }
        const conditions = rule.conditions.filter(
            (c) => !usesPlayedCard(c.lhs) && !usesPlayedCard(c.rhs),
        );
        const effects = rule.effects.filter(
            (e) =>
                e.type !== "acceptCard" &&
                e.type !== "rejectCard" &&
                e.type !== "playAgain",
        );
        onChange({
            ...rule,
            event: next,
            conditions,
            effects:
                effects.length > 0
                    ? effects
                    : [
                          {
                              ...defaultEffect("turnStarted"),
                              key: crypto.randomUUID(),
                          },
                      ],
        });
    }

    function addCondition() {
        const condition: DraftCondition = {
            ...defaultCondition(rule.event),
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
            ...defaultEffect(rule.event),
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

    const addButtonClass =
        "wc-chip self-start rounded-lg px-3 py-1.5 text-xs font-bold";
    const addButtonStyle: CSSProperties = {
        background: "var(--cream2)",
        border: "2px solid var(--ink)",
        boxShadow: "0 2px 0 var(--ink)",
        color: "var(--ink)",
    };

    return (
        <article className="panel flex flex-col gap-4 p-4 sm:p-5">
            {/* Header: priority stamp, name, event badge, ordering controls. */}
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className="stamp"
                    style={{ background: "var(--cream2)", color: "var(--ink)" }}
                >
                    #{index + 1}
                </span>
                <input
                    value={rule.name}
                    onChange={(e) =>
                        onChange({ ...rule, name: e.target.value })
                    }
                    maxLength={ECA_RULE_NAME_MAX}
                    aria-label={t("rule_name_label")}
                    placeholder={t("rule_default_name")}
                    className={`${fieldClass} min-w-36 flex-1`}
                    style={fieldStyle}
                />
                <span className="stamp" style={EVENT_STAMP[rule.event]}>
                    {rule.event === "cardPlayed"
                        ? t("event_cardPlayed_short")
                        : t("event_turnStarted_short")}
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

            {/* QUAND */}
            <section className="flex flex-col gap-2">
                <p className={labelClass} style={labelStyle}>
                    {t("when_title")}
                </p>
                <select
                    value={rule.event}
                    onChange={(e) => switchEvent(e.target.value)}
                    aria-label={t("when_title")}
                    className={fieldClass}
                    style={fieldStyle}
                >
                    <option value="cardPlayed">{t("event_cardPlayed")}</option>
                    <option value="turnStarted">
                        {t("event_turnStarted")}
                    </option>
                </select>
            </section>

            {/* SI */}
            <section className="flex flex-col gap-2">
                <p className={labelClass} style={labelStyle}>
                    {t("if_title")}
                </p>
                {rule.conditions.length === 0 && (
                    <p
                        className="text-xs font-semibold"
                        style={{ color: "#5a5340" }}
                    >
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
                    style={addButtonStyle}
                >
                    + {t("add_condition")}
                </button>
            </section>

            {/* ALORS */}
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
                    className={`${addButtonClass} disabled:opacity-40`}
                    style={addButtonStyle}
                >
                    + {t("add_effect")}
                </button>
            </section>
        </article>
    );
}
