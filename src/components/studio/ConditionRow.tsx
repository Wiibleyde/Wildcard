"use client";

import { useTranslations } from "next-intl";
import { dangerIconButtonClass, fieldClass } from "@/components/ui/fields";
import { SelectField } from "@/components/ui/SelectField";
import { comparatorsFor, isOneOf, reconcileCondition } from "@/lib/eca/schema";
import type {
    EcaComparator,
    EcaCondition,
    EcaDeckId,
    EcaEventType,
    EcaOperand,
} from "@/lib/eca/types";
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
            <SelectField
                value={condition.op}
                onChange={handleComparator}
                className={`${fieldClass} w-full text-center sm:w-16 sm:shrink-0`}
                ariaLabel={t("comparator_label")}
                options={comparators.map((op) => ({
                    value: op,
                    label: COMPARATOR_SYMBOLS[op],
                }))}
            />
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
                className={`${dangerIconButtonClass} self-end  sm:self-auto`}
            >
                ✕
            </button>
        </StudioRow>
    );
}
