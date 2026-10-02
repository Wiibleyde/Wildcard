"use client";

import { useTranslations } from "next-intl";
import { DECKS } from "@/lib/card/decks";
import type { Suit } from "@/lib/card/types";
import {
    defaultLiteral,
    ECA_CARD_PROPS,
    ECA_CARD_SOURCES,
    ECA_STAT_SOURCES,
    literalDomainFor,
} from "@/lib/eca/schema";
import type {
    EcaCardProp,
    EcaCardSource,
    EcaDeckId,
    EcaEventType,
    EcaOperand,
    EcaStatSource,
} from "@/lib/eca/types";
import { fieldClass, fieldStyle } from "./fields";
import type { StudioMessageKey } from "./messages";

/**
 * One side of a condition. The literal editor's shape follows the other side,
 * so a rank `"7"` can't be typed as the number `7`.
 */

const CARD_LABELS: Record<
    EcaCardSource,
    Record<EcaCardProp, StudioMessageKey>
> = {
    playedCard: {
        rank: "operand_played_rank",
        suit: "operand_played_suit",
        value: "operand_played_value",
    },
    topDiscard: {
        rank: "operand_top_rank",
        suit: "operand_top_suit",
        value: "operand_top_value",
    },
};

const STAT_LABELS: Record<EcaStatSource, StudioMessageKey> = {
    actorHandCount: "operand_hand_count",
    drawPileCount: "operand_draw_count",
    discardPileCount: "operand_discard_count",
};

const SUIT_LABELS: Record<Suit, StudioMessageKey> = {
    spades: "suit_spades",
    hearts: "suit_hearts",
    diamonds: "suit_diamonds",
    clubs: "suit_clubs",
};

interface Choice {
    readonly id: string;
    readonly labelKey: StudioMessageKey;
    /** `null` = the literal choice. */
    readonly operand: EcaOperand | null;
}

const LITERAL_ID = "literal";

function encode(operand: EcaOperand): string {
    switch (operand.kind) {
        case "card":
            return `card:${operand.source}:${operand.prop}`;
        case "stat":
            return `stat:${operand.source}`;
        case "literal":
            return LITERAL_ID;
    }
}

function choice(operand: EcaOperand, labelKey: StudioMessageKey): Choice {
    return { id: encode(operand), labelKey, operand };
}

function choicesFor(event: EcaEventType): readonly Choice[] {
    const cards = ECA_CARD_SOURCES.filter(
        (source) => source !== "playedCard" || event === "cardPlayed",
    ).flatMap((source) =>
        ECA_CARD_PROPS.map((prop) =>
            choice({ kind: "card", source, prop }, CARD_LABELS[source][prop]),
        ),
    );
    const stats = ECA_STAT_SOURCES.map((source) =>
        choice({ kind: "stat", source }, STAT_LABELS[source]),
    );
    return [
        ...cards,
        ...stats,
        { id: LITERAL_ID, labelKey: "operand_literal", operand: null },
    ];
}

interface Props {
    readonly operand: EcaOperand;
    /** Drives the literal editor's shape. */
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
    const t = useTranslations("studio");
    const choices = choicesFor(event);
    const domain = literalDomainFor(counterpart);
    const { ranks, suits } = DECKS[deckId];

    function handleSelect(id: string) {
        const picked = choices.find((c) => c.id === id);
        if (!picked) return;
        if (picked.operand !== null) {
            onChange(picked.operand);
        } else if (operand.kind !== "literal") {
            onChange({
                kind: "literal",
                value: defaultLiteral(domain, deckId),
            });
        }
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
                {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                        {t(c.labelKey)}
                    </option>
                ))}
            </select>

            {operand.kind === "literal" && domain === "rank" && (
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

            {operand.kind === "literal" && domain === "suit" && (
                <select
                    value={String(operand.value)}
                    onChange={(e) =>
                        onChange({ kind: "literal", value: e.target.value })
                    }
                    aria-label={t("literal_suit_label")}
                    className={`${fieldClass} w-28 shrink-0`}
                    style={fieldStyle}
                >
                    {suits.map((suit) => (
                        <option key={suit} value={suit}>
                            {t(SUIT_LABELS[suit])}
                        </option>
                    ))}
                </select>
            )}

            {operand.kind === "literal" && domain === "number" && (
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
