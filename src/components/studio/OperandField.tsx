"use client";

import { useTranslations } from "next-intl";
import { DECKS } from "@/lib/card/decks";
import type { Suit } from "@/lib/card/types";
import type { EcaDeckId, EcaEventType, EcaOperand } from "@/lib/eca";
import type { Translate } from "@/lib/games/catalogView";
import { fieldClass, fieldStyle } from "./fields";

/**
 * One side of a condition. A single select covers every card/stat source; the
 * "fixed value" choice reveals a literal editor whose SHAPE follows the other
 * side of the comparison — a rank picker against a rank, a suit picker against
 * a suit, a number everywhere else — so creators can't type `7` (number) when
 * the rank `"7"` (string) was meant.
 */

interface Choice {
    readonly id: string;
    readonly labelKey: string;
    /** `null` = the literal choice (built from the counterpart's shape). */
    readonly operand: EcaOperand | null;
}

const CHOICES: readonly Choice[] = [
    {
        id: "card:playedCard:rank",
        labelKey: "operand_played_rank",
        operand: { kind: "card", source: "playedCard", prop: "rank" },
    },
    {
        id: "card:playedCard:suit",
        labelKey: "operand_played_suit",
        operand: { kind: "card", source: "playedCard", prop: "suit" },
    },
    {
        id: "card:playedCard:value",
        labelKey: "operand_played_value",
        operand: { kind: "card", source: "playedCard", prop: "value" },
    },
    {
        id: "card:topDiscard:rank",
        labelKey: "operand_top_rank",
        operand: { kind: "card", source: "topDiscard", prop: "rank" },
    },
    {
        id: "card:topDiscard:suit",
        labelKey: "operand_top_suit",
        operand: { kind: "card", source: "topDiscard", prop: "suit" },
    },
    {
        id: "card:topDiscard:value",
        labelKey: "operand_top_value",
        operand: { kind: "card", source: "topDiscard", prop: "value" },
    },
    {
        id: "stat:actorHandCount",
        labelKey: "operand_hand_count",
        operand: { kind: "stat", source: "actorHandCount" },
    },
    {
        id: "stat:drawPileCount",
        labelKey: "operand_draw_count",
        operand: { kind: "stat", source: "drawPileCount" },
    },
    {
        id: "stat:discardPileCount",
        labelKey: "operand_discard_count",
        operand: { kind: "stat", source: "discardPileCount" },
    },
    { id: "literal", labelKey: "operand_literal", operand: null },
];

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const SUIT_KEYS: Record<Suit, string> = {
    spades: "suit_spades",
    hearts: "suit_hearts",
    diamonds: "suit_diamonds",
    clubs: "suit_clubs",
};

export type LiteralMode = "rank" | "suit" | "number";

/** The literal-editor shape a counterpart operand demands. */
export function literalModeFor(counterpart: EcaOperand): LiteralMode {
    if (counterpart.kind === "card") {
        if (counterpart.prop === "rank") return "rank";
        if (counterpart.prop === "suit") return "suit";
    }
    return "number";
}

function encode(operand: EcaOperand): string {
    switch (operand.kind) {
        case "card":
            return `card:${operand.source}:${operand.prop}`;
        case "stat":
            return `stat:${operand.source}`;
        case "literal":
            return "literal";
    }
}

interface Props {
    readonly operand: EcaOperand;
    /** The other side of the condition — drives the literal editor's shape. */
    readonly counterpart: EcaOperand;
    readonly event: EcaEventType;
    readonly deckId: EcaDeckId;
    readonly onChange: (operand: EcaOperand) => void;
}

export function OperandField({
    operand,
    counterpart,
    event,
    deckId,
    onChange,
}: Props) {
    // Dynamic labelKey lookups need the loose Translate shape.
    const t = useTranslations("studio") as unknown as Translate;

    // `playedCard` only exists while a card is being played.
    const choices =
        event === "cardPlayed"
            ? CHOICES
            : CHOICES.filter((c) => !c.id.startsWith("card:playedCard"));

    const mode = literalModeFor(counterpart);
    const ranks = DECKS[deckId].ranks;

    function handleSelect(id: string) {
        const choice = choices.find((c) => c.id === id);
        if (!choice) return;
        if (choice.operand !== null) {
            onChange(choice.operand);
            return;
        }
        if (operand.kind === "literal") return; // already a literal — keep it
        const value =
            mode === "rank" ? ranks[0] : mode === "suit" ? "spades" : 0;
        onChange({ kind: "literal", value });
    }

    function handleNumber(raw: string) {
        const parsed = Number(raw);
        onChange({
            kind: "literal",
            value: Number.isFinite(parsed) ? parsed : 0,
        });
    }

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2">
            <select
                value={encode(operand)}
                onChange={(e) => handleSelect(e.target.value)}
                aria-label={t("operand_label")}
                className={`${fieldClass} min-w-0 flex-1`}
                style={fieldStyle}
            >
                {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                        {t(choice.labelKey)}
                    </option>
                ))}
            </select>

            {operand.kind === "literal" && mode === "rank" && (
                <select
                    value={String(operand.value)}
                    onChange={(e) =>
                        onChange({ kind: "literal", value: e.target.value })
                    }
                    aria-label={t("literal_rank_label")}
                    className={`${fieldClass} w-18 shrink-0`}
                    style={fieldStyle}
                >
                    {ranks.map((rank) => (
                        <option key={rank} value={rank}>
                            {rank}
                        </option>
                    ))}
                </select>
            )}

            {operand.kind === "literal" && mode === "suit" && (
                <select
                    value={String(operand.value)}
                    onChange={(e) =>
                        onChange({ kind: "literal", value: e.target.value })
                    }
                    aria-label={t("literal_suit_label")}
                    className={`${fieldClass} w-28 shrink-0`}
                    style={fieldStyle}
                >
                    {SUITS.map((suit) => (
                        <option key={suit} value={suit}>
                            {t(SUIT_KEYS[suit])}
                        </option>
                    ))}
                </select>
            )}

            {operand.kind === "literal" && mode === "number" && (
                <input
                    type="number"
                    value={
                        typeof operand.value === "number" ? operand.value : 0
                    }
                    onChange={(e) => handleNumber(e.target.value)}
                    aria-label={t("literal_number_label")}
                    className={`${fieldClass} w-18 shrink-0`}
                    style={fieldStyle}
                />
            )}
        </div>
    );
}
