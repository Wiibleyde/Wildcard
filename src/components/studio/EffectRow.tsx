"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/base/input";
import {
    dangerIconButtonClass,
    fieldClass,
    fieldLabelClass,
} from "@/components/ui/fields";
import { SelectField } from "@/components/ui/SelectField";
import {
    ECA_DRAW_TARGETS,
    ECA_EFFECT_SPECS,
    type EcaEffectType,
    effectTypesFor,
    isOneOf,
} from "@/lib/eca/schema";
import type { StudioMessageKey } from "@/lib/eca/studioMessages";
import type { EcaDrawTarget, EcaEffect, EcaEventType } from "@/lib/eca/types";
import { ECA_DRAW_COUNT_MAX, ECA_DRAW_COUNT_MIN } from "@/lib/eca/validate";
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
            <SelectField
                value={effect.type}
                onChange={handleType}
                ariaLabel={t("effect_type_label")}
                className={`${fieldClass} min-w-0 flex-1`}
                options={types.map((type) => ({
                    value: type,
                    label: t(EFFECT_LABELS[type]),
                }))}
            />

            {effect.type === "drawCards" && (
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={ECA_DRAW_COUNT_MIN}
                        max={ECA_DRAW_COUNT_MAX}
                        value={effect.count}
                        onChange={(e) => handleCount(e.target.value)}
                        aria-label={t("effect_count_aria")}
                        className={`${fieldClass} w-16 shrink-0`}
                    />
                    <span className={fieldLabelClass}>
                        {t("effect_count_label")} →
                    </span>
                    <SelectField
                        value={effect.target}
                        onChange={handleTarget}
                        ariaLabel={t("effect_target_label")}
                        className={`${fieldClass} shrink-0`}
                        options={ECA_DRAW_TARGETS.map((target) => ({
                            value: target,
                            label: t(TARGET_LABELS[target]),
                        }))}
                    />
                </div>
            )}

            <button
                type="button"
                onClick={onRemove}
                disabled={!removable}
                aria-label={t("remove_effect")}
                className={`${dangerIconButtonClass} self-end   sm:self-auto`}
            >
                ✕
            </button>
        </StudioRow>
    );
}
