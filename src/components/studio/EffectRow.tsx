"use client";

import { useTranslations } from "next-intl";
import {
    ECA_DRAW_TARGETS,
    ECA_EFFECT_SPECS,
    type EcaEffectType,
    effectTypesFor,
    isOneOf,
} from "@/lib/eca/schema";
import type { EcaDrawTarget, EcaEffect, EcaEventType } from "@/lib/eca/types";
import { ECA_DRAW_COUNT_MAX, ECA_DRAW_COUNT_MIN } from "@/lib/eca/validate";
import {
    dangerButtonStyle,
    fieldClass,
    fieldStyle,
    labelClass,
    labelStyle,
} from "./fields";
import type { StudioMessageKey } from "./messages";
import { StudioRow } from "./StudioRow";

const EFFECT_LABELS: Record<EcaEffectType, StudioMessageKey> = {
    acceptCard: "effect_acceptCard",
    rejectCard: "effect_rejectCard",
    drawCards: "effect_drawCards",
    skipNextPlayer: "effect_skipNextPlayer",
    reverseDirection: "effect_reverseDirection",
    playAgain: "effect_playAgain",
    endGame: "effect_endGame",
};

const TARGET_LABELS: Record<EcaDrawTarget, StudioMessageKey> = {
    actor: "effect_target_actor",
    nextPlayer: "effect_target_nextPlayer",
};

interface Props {
    readonly effect: EcaEffect;
    readonly event: EcaEventType;
    readonly onChange: (effect: EcaEffect) => void;
    readonly onRemove: () => void;
    /** A rule needs at least one effect. */
    readonly removable: boolean;
}

export function EffectRow({
    effect,
    event,
    onChange,
    onRemove,
    removable,
}: Props) {
    const t = useTranslations("studio");
    const types = effectTypesFor(event);

    function handleType(type: string) {
        if (isOneOf(type, types) && type !== effect.type) {
            onChange(ECA_EFFECT_SPECS[type].create());
        }
    }

    function handleCount(raw: string) {
        if (effect.type !== "drawCards") return;
        const parsed = Number.parseInt(raw, 10);
        const count = Number.isNaN(parsed)
            ? ECA_DRAW_COUNT_MIN
            : Math.min(
                  ECA_DRAW_COUNT_MAX,
                  Math.max(ECA_DRAW_COUNT_MIN, parsed),
              );
        onChange({ ...effect, count });
    }

    function handleTarget(target: string) {
        if (effect.type === "drawCards" && isOneOf(target, ECA_DRAW_TARGETS)) {
            onChange({ ...effect, target });
        }
    }

    return (
        <StudioRow>
            <select
                value={effect.type}
                onChange={(e) => handleType(e.target.value)}
                aria-label={t("effect_type_label")}
                className={`${fieldClass} min-w-0 flex-1`}
                style={fieldStyle}
            >
                {types.map((type) => (
                    <option key={type} value={type}>
                        {t(EFFECT_LABELS[type])}
                    </option>
                ))}
            </select>

            {effect.type === "drawCards" && (
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={ECA_DRAW_COUNT_MIN}
                        max={ECA_DRAW_COUNT_MAX}
                        value={effect.count}
                        onChange={(e) => handleCount(e.target.value)}
                        aria-label={t("effect_count_aria")}
                        className={`${fieldClass} w-16 shrink-0`}
                        style={fieldStyle}
                    />
                    <span className={labelClass} style={labelStyle}>
                        {t("effect_count_label")} →
                    </span>
                    <select
                        value={effect.target}
                        onChange={(e) => handleTarget(e.target.value)}
                        aria-label={t("effect_target_label")}
                        className={`${fieldClass} shrink-0`}
                        style={fieldStyle}
                    >
                        {ECA_DRAW_TARGETS.map((target) => (
                            <option key={target} value={target}>
                                {t(TARGET_LABELS[target])}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <button
                type="button"
                onClick={onRemove}
                disabled={!removable}
                aria-label={t("remove_effect")}
                className="wc-iconbtn grid h-8 w-8 shrink-0 place-items-center self-end rounded-lg text-sm font-bold disabled:opacity-40 sm:self-auto"
                style={dangerButtonStyle}
            >
                ✕
            </button>
        </StudioRow>
    );
}
