"use client";

import { useTranslations } from "next-intl";
import { DECKS } from "@/lib/card/decks";
import type { Rank } from "@/lib/card/types";
import type {
    EcaComparator,
    EcaCondition,
    EcaDeckId,
    EcaEventType,
    EcaOperand,
} from "@/lib/eca";
import { dangerButtonStyle, fieldClass, fieldStyle } from "./fields";
import { literalModeFor, OperandField, SUITS } from "./OperandField";

/** One SI row: left operand · comparator · right operand · remove. */

/**
 * The literal editor's SHAPE (rank / suit / number) is derived from the
 * counterpart operand, but the stored value is not: when the counterpart
 * changes shape, a literal on the other side could keep an incompatible value
 * (the select would DISPLAY its first option while the draft still held the
 * old value). Reconcile on every operand change: if `other` is a literal
 * whose value no longer fits the changed counterpart's shape, coerce it to
 * that shape's default — otherwise return it untouched.
 */
function reconcileLiteral(
    changed: EcaOperand,
    other: EcaOperand,
    deckRanks: readonly Rank[],
): EcaOperand {
    if (other.kind !== "literal") return other;
    const mode = literalModeFor(changed);
    if (mode === "rank") {
        return deckRanks.some((rank) => rank === other.value)
            ? other
            : { kind: "literal", value: deckRanks[0] };
    }
    if (mode === "suit") {
        return SUITS.some((suit) => suit === other.value)
            ? other
            : { kind: "literal", value: SUITS[0] };
    }
    return typeof other.value === "number"
        ? other
        : { kind: "literal", value: 0 };
}

const COMPARATORS: ReadonlyArray<{
    readonly id: EcaComparator;
    readonly label: string;
}> = [
    { id: "eq", label: "=" },
    { id: "neq", label: "≠" },
    { id: "gt", label: ">" },
    { id: "gte", label: "≥" },
    { id: "lt", label: "<" },
    { id: "lte", label: "≤" },
];

interface Props {
    readonly condition: EcaCondition;
    readonly event: EcaEventType;
    readonly deckId: EcaDeckId;
    readonly onChange: (condition: EcaCondition) => void;
    readonly onRemove: () => void;
}

export function ConditionRow({
    condition,
    event,
    deckId,
    onChange,
    onRemove,
}: Props) {
    const t = useTranslations("studio");
    const ranks = DECKS[deckId].ranks;

    function handleComparator(id: string) {
        const next = COMPARATORS.find((c) => c.id === id);
        if (next) onChange({ ...condition, op: next.id });
    }

    /** Changing one side may invalidate a literal on the other — coerce it. */
    function handleLhs(lhs: EcaOperand) {
        onChange({
            ...condition,
            lhs,
            rhs: reconcileLiteral(lhs, condition.rhs, ranks),
        });
    }

    function handleRhs(rhs: EcaOperand) {
        onChange({
            ...condition,
            rhs,
            lhs: reconcileLiteral(rhs, condition.lhs, ranks),
        });
    }

    return (
        <div
            className="flex flex-col gap-2 rounded-xl p-2.5 sm:flex-row sm:items-center"
            style={{
                background: "var(--cream)",
                border: "2px solid var(--ink)",
            }}
        >
            <OperandField
                operand={condition.lhs}
                counterpart={condition.rhs}
                event={event}
                deckId={deckId}
                onChange={handleLhs}
            />
            <select
                value={condition.op}
                onChange={(e) => handleComparator(e.target.value)}
                className={`${fieldClass} w-full text-center sm:w-16 sm:shrink-0`}
                style={fieldStyle}
                aria-label={t("comparator_label")}
            >
                {COMPARATORS.map((comparator) => (
                    <option key={comparator.id} value={comparator.id}>
                        {comparator.label}
                    </option>
                ))}
            </select>
            <OperandField
                operand={condition.rhs}
                counterpart={condition.lhs}
                event={event}
                deckId={deckId}
                onChange={handleRhs}
            />
            <button
                type="button"
                onClick={onRemove}
                aria-label={t("remove_condition")}
                className="wc-iconbtn grid h-8 w-8 shrink-0 place-items-center self-end rounded-lg text-sm font-bold sm:self-auto"
                style={dangerButtonStyle}
            >
                ✕
            </button>
        </div>
    );
}
