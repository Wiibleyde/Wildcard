"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, type MouseEvent, useCallback } from "react";
import { freeTheme } from "@/lib/card/themes/free";
import type {
    CardDescriptor,
    CardEffect,
    CardTheme,
    Rank,
    Suit,
} from "@/lib/card/types";
import { CardBack } from "./CardBack";
import { FoolContent, JokerContent } from "./SpecialCards";
import { SuitedContent } from "./SuitedCard";
import { TrumpContent } from "./TrumpCard";

function buildBorderStyle(theme: CardTheme): CSSProperties {
    const width = theme.border.width ?? 2.5;
    const border = `${width}px solid ${theme.border.color}`;
    if (theme.border.boxShadow) {
        return { border, boxShadow: theme.border.boxShadow };
    }
    if (theme.border.effect === "glow" && theme.border.glowColor) {
        const spread = theme.border.glowSize ?? 8;
        return {
            border,
            boxShadow: `0 0 ${spread}px ${Math.round(spread / 3)}px ${theme.border.glowColor}`,
        };
    }
    return { border };
}

// Only the colour is consumed by globals.css (`--card-effect-color`); speed has no CSS hook yet.
function effectStyle(
    effects: readonly CardEffect[] | undefined,
): CSSProperties {
    const color = effects?.find((e) => e.color)?.color;
    return color ? ({ "--card-effect-color": color } as CSSProperties) : {};
}

function CardFaceContent({
    card,
    theme,
}: {
    card: CardDescriptor;
    theme: CardTheme;
}) {
    if (card.type === "suited")
        return <SuitedContent card={card} theme={theme} />;
    if (card.type === "trump")
        return <TrumpContent index={card.index} theme={theme} />;
    if (card.type === "fool") return <FoolContent theme={theme} />;
    return <JokerContent variant={card.variant} theme={theme} />;
}

const FACE_RANK_KEY: Partial<
    Record<Rank, "rank_A" | "rank_J" | "rank_C" | "rank_Q" | "rank_K">
> = { A: "rank_A", J: "rank_J", C: "rank_C", Q: "rank_Q", K: "rank_K" };

const SUIT_KEY: Record<
    Suit,
    "suit_spades" | "suit_hearts" | "suit_diamonds" | "suit_clubs"
> = {
    spades: "suit_spades",
    hearts: "suit_hearts",
    diamonds: "suit_diamonds",
    clubs: "suit_clubs",
};

export function useCardLabel(): (
    card: CardDescriptor,
    faceDown?: boolean,
) => string {
    const t = useTranslations("card");
    return useCallback(
        (card: CardDescriptor, faceDown = false) => {
            if (faceDown) return t("face_down");
            switch (card.type) {
                case "suited": {
                    const faceKey = FACE_RANK_KEY[card.rank];
                    return t("suited", {
                        rank: faceKey ? t(faceKey) : card.rank,
                        suit: t(SUIT_KEY[card.suit]),
                    });
                }
                case "trump":
                    return t("trump", { index: card.index });
                case "fool":
                    return t("fool");
                default:
                    return t("joker");
            }
        },
        [t],
    );
}

export interface CardProps {
    card: CardDescriptor;
    theme?: CardTheme;
    faceDown?: boolean;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /** `aria-pressed` for a selectable card. */
    pressed?: boolean;
}

export function Card({
    card,
    theme = freeTheme,
    faceDown = false,
    onClick,
    pressed,
}: CardProps) {
    const labelOf = useCardLabel();
    const label = labelOf(card, faceDown);
    const effects = faceDown ? theme.back.effects : theme.effects;
    const style: CSSProperties = {
        aspectRatio: "5 / 7",
        containerType: "inline-size",
        borderRadius: "6%",
        fontFamily: theme.font?.family,
        ...buildBorderStyle(theme),
        ...effectStyle(effects),
        ...(faceDown
            ? {
                  background: theme.back.artwork
                      ? undefined
                      : (theme.back.pattern ?? theme.back.color),
                  backgroundColor: theme.back.artwork
                      ? undefined
                      : theme.back.color,
              }
            : { backgroundColor: theme.backgroundColor }),
    };
    const cls = `relative block w-full select-none overflow-hidden${onClick ? " cursor-pointer" : ""}`;
    const effectAttr = effects?.length
        ? effects.map((e) => e.type).join(" ")
        : undefined;

    const content = faceDown ? (
        <CardBack theme={theme} />
    ) : (
        <CardFaceContent card={card} theme={theme} />
    );

    if (onClick) {
        return (
            <button
                type="button"
                className={cls}
                style={style}
                data-card-effect={effectAttr}
                aria-label={label}
                aria-pressed={pressed}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return (
        <div
            className={cls}
            style={style}
            data-card-effect={effectAttr}
            role="img"
            aria-label={label}
        >
            {content}
        </div>
    );
}
