"use client";

import { useTranslations } from "next-intl";
import {
    type CSSProperties,
    type MouseEvent,
    type Ref,
    useCallback,
} from "react";
import { freeTheme } from "@/lib/card/themes/free";
import type { CardDescriptor, CardTheme, Rank, Suit } from "@/lib/card/types";
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

function cardEffectsAttr(theme: CardTheme): string | undefined {
    const types = theme.effects?.map((e) => e.type);
    return types?.length ? types.join(" ") : undefined;
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

/**
 * Localised accessible name for a card ("10 de pique", "Dame de cœur",
 * "Atout 21", "Carte face cachée") — the visual pips/indices read as noise to
 * a screen reader, and a face-down card would otherwise be an empty button.
 */
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
    selected?: boolean;
    /** Strip CSS transitions/transforms whenever GSAP (or D&D) drives position. */
    disableTransitions?: boolean;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /** Toggle state for a selectable card (`aria-pressed`). */
    pressed?: boolean;
    className?: string;
    /** Required for GSAP targets. */
    ref?: Ref<HTMLElement>;
}

export function Card({
    card,
    theme = freeTheme,
    faceDown = false,
    selected = false,
    disableTransitions = false,
    onClick,
    pressed,
    className = "",
    ref,
}: CardProps) {
    const labelOf = useCardLabel();
    const label = labelOf(card, faceDown);
    const base: CSSProperties = {
        aspectRatio: "5 / 7",
        containerType: "inline-size",
        borderRadius: "6%",
        fontFamily: theme.font?.family,
        ...buildBorderStyle(theme),
    };

    const cls = [
        "relative block w-full select-none overflow-hidden",
        !disableTransitions && "transition-transform duration-150",
        !disableTransitions &&
            onClick &&
            "hover:-translate-y-1 active:scale-95",
        !disableTransitions && selected && "-translate-y-3",
        onClick ? "cursor-pointer" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const style: CSSProperties = faceDown
        ? {
              ...base,
              background: theme.back.artwork
                  ? undefined
                  : (theme.back.pattern ?? theme.back.color),
              backgroundColor: theme.back.artwork
                  ? undefined
                  : theme.back.color,
          }
        : { ...base, backgroundColor: theme.backgroundColor };

    const content = faceDown ? (
        <CardBack theme={theme} />
    ) : (
        <CardFaceContent card={card} theme={theme} />
    );

    if (onClick) {
        return (
            <button
                ref={ref as Ref<HTMLButtonElement>}
                type="button"
                className={cls}
                style={style}
                data-card-effect={faceDown ? undefined : cardEffectsAttr(theme)}
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
            ref={ref as Ref<HTMLDivElement>}
            className={cls}
            style={style}
            data-card-effect={faceDown ? undefined : cardEffectsAttr(theme)}
            role="img"
            aria-label={label}
        >
            {content}
        </div>
    );
}
