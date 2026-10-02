"use client";

import { useTranslations } from "next-intl";
import { comparatorsFor, isOneOf, reconcileCondition } from "@/lib/eca/schema";
import type {
    EcaComparator,
    EcaCondition,
    EcaDeckId,
    EcaEventType,
    EcaOperand,
} from "@/lib/eca/types";
import { dangerButtonStyle, fieldClass, fieldStyle } from "./fields";
import { OperandField } from "./OperandField";
import { StudioRow } from "./StudioRow";

const COMPARATOR_SYMBOLS: Record<EcaComparator, string> = {
    eq: "=",
    neq: "≠",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
};

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
    const allowed = comparatorsFor(condition.lhs, condition.rhs);
    // Keep a stored out-of-domain comparator visible; the validator flags it.
    const comparators = allowed.includes(condition.op)
        ? allowed
        : [...allowed, condition.op];

    function handleComparator(op: string) {
        if (isOneOf(op, comparators)) onChange({ ...condition, op });
    }

    // Changing a side may leave the other side's literal or the comparator out of domain.
    function handleOperand(side: "lhs" | "rhs", operand: EcaOperand) {
        const next: EcaCondition =
            side === "lhs"
                ? { ...condition, lhs: operand }
                : { ...condition, rhs: operand };
        onChange(reconcileCondition(next, deckId));
    }

    return (
        <StudioRow>
            <OperandField
                operand={condition.lhs}
                counterpart={condition.rhs}
                event={event}
                deckId={deckId}
                onChange={(lhs) => handleOperand("lhs", lhs)}
            />
            <select
                value={condition.op}
                onChange={(e) => handleComparator(e.target.value)}
                className={`${fieldClass} w-full text-center sm:w-16 sm:shrink-0`}
                style={fieldStyle}
                aria-label={t("comparator_label")}
            >
                {comparators.map((op) => (
                    <option key={op} value={op}>
                        {COMPARATOR_SYMBOLS[op]}
                    </option>
                ))}
            </select>
            <OperandField
                operand={condition.rhs}
                counterpart={condition.lhs}
                event={event}
                deckId={deckId}
                onChange={(rhs) => handleOperand("rhs", rhs)}
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
        </StudioRow>
    );
}
