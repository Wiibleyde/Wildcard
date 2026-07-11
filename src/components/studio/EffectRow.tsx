"use client";

import { useTranslations } from "next-intl";
import type { EcaEffect, EcaEventType } from "@/lib/eca";
import { ECA_DRAW_COUNT_MAX, ECA_DRAW_COUNT_MIN } from "@/lib/eca";
import type { Translate } from "@/lib/games/catalogView";
import { dangerButtonStyle, fieldClass, fieldStyle } from "./fields";

/** One ALORS row: effect type select + its parameters. */

type EffectType = EcaEffect["type"];

const EFFECT_TYPES: ReadonlyArray<{
    readonly id: EffectType;
    readonly labelKey: string;
    /** acceptCard / rejectCard / playAgain only answer a played card. */
    readonly cardPlayedOnly: boolean;
}> = [
    { id: "acceptCard", labelKey: "effect_acceptCard", cardPlayedOnly: true },
    { id: "rejectCard", labelKey: "effect_rejectCard", cardPlayedOnly: true },
    { id: "drawCards", labelKey: "effect_drawCards", cardPlayedOnly: false },
    {
        id: "skipNextPlayer",
        labelKey: "effect_skipNextPlayer",
        cardPlayedOnly: false,
    },
    {
        id: "reverseDirection",
        labelKey: "effect_reverseDirection",
        cardPlayedOnly: false,
    },
    { id: "playAgain", labelKey: "effect_playAgain", cardPlayedOnly: true },
    { id: "endGame", labelKey: "effect_endGame", cardPlayedOnly: false },
];

function defaultEffect(type: EffectType): EcaEffect {
    switch (type) {
        case "acceptCard":
            return { type: "acceptCard" };
        case "rejectCard":
            return { type: "rejectCard" };
        case "drawCards":
            return { type: "drawCards", target: "nextPlayer", count: 1 };
        case "skipNextPlayer":
            return { type: "skipNextPlayer" };
        case "reverseDirection":
            return { type: "reverseDirection" };
        case "playAgain":
            return { type: "playAgain" };
        case "endGame":
            return { type: "endGame", winner: "actor" };
    }
}

interface Props {
    readonly effect: EcaEffect;
    readonly event: EcaEventType;
    readonly onChange: (effect: EcaEffect) => void;
    readonly onRemove: () => void;
    /** The last effect of a rule cannot be removed (a rule needs ≥ 1). */
    readonly removable: boolean;
}

export function EffectRow({
    effect,
    event,
    onChange,
    onRemove,
    removable,
}: Props) {
    // Dynamic labelKey lookups need the loose Translate shape.
    const t = useTranslations("studio") as unknown as Translate;

    const types =
        event === "cardPlayed"
            ? EFFECT_TYPES
            : EFFECT_TYPES.filter((entry) => !entry.cardPlayedOnly);

    function handleType(id: string) {
        const entry = types.find((candidate) => candidate.id === id);
        if (entry && entry.id !== effect.type)
            onChange(defaultEffect(entry.id));
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

    return (
        <div
            className="flex flex-col gap-2 rounded-xl p-2.5 sm:flex-row sm:items-center"
            style={{
                background: "var(--cream)",
                border: "2px solid var(--ink)",
            }}
        >
            <select
                value={effect.type}
                onChange={(e) => handleType(e.target.value)}
                aria-label={t("effect_type_label")}
                className={`${fieldClass} min-w-0 flex-1`}
                style={fieldStyle}
            >
                {types.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                        {t(entry.labelKey)}
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
                        aria-label={t("effect_count_label")}
                        className={`${fieldClass} w-16 shrink-0`}
                        style={fieldStyle}
                    />
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#5a5340" }}
                    >
                        {t("effect_count_label")} →
                    </span>
                    <select
                        value={effect.target}
                        onChange={(e) =>
                            onChange({
                                ...effect,
                                target:
                                    e.target.value === "actor"
                                        ? "actor"
                                        : "nextPlayer",
                            })
                        }
                        aria-label={t("effect_target_label")}
                        className={`${fieldClass} shrink-0`}
                        style={fieldStyle}
                    >
                        <option value="actor">
                            {t("effect_target_actor")}
                        </option>
                        <option value="nextPlayer">
                            {t("effect_target_nextPlayer")}
                        </option>
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
        </div>
    );
}
