"use client";

import type { CSSProperties, Ref } from "react";
import { freeTheme } from "@/lib/card/themes/free";
import type { CardDescriptor, CardTheme } from "@/lib/card/types";
import { CardBack } from "./CardBack";
import { FoolContent, JokerContent } from "./SpecialCards";
import { SuitedContent } from "./SuitedCard";
import { TrumpContent } from "./TrumpCard";

function buildBorderStyle(theme: CardTheme): CSSProperties {
  if (theme.border.boxShadow) {
    return {
      border: `2px solid ${theme.border.color}`,
      boxShadow: theme.border.boxShadow,
    };
  }
  if (theme.border.effect === "glow" && theme.border.glowColor) {
    const spread = theme.border.glowSize ?? 8;
    return {
      border: `2px solid ${theme.border.color}`,
      boxShadow: `0 0 ${spread}px ${Math.round(spread / 3)}px ${theme.border.glowColor}`,
    };
  }
  return { border: `2px solid ${theme.border.color}` };
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

export interface CardProps {
  card: CardDescriptor;
  theme?: CardTheme;
  /** Render the card back instead of its face */
  faceDown?: boolean;
  /** Lift the card upward via CSS transform (only when disableTransitions is false) */
  selected?: boolean;
  /**
   * Strip all CSS transitions and transform classes from the root element.
   * Set to true whenever GSAP (or a D&D library) drives this card's position.
   */
  disableTransitions?: boolean;
  onClick?: () => void;
  className?: string;
  /** Ref forwarded to the root DOM element — required for GSAP targets */
  ref?: Ref<HTMLElement>;
}

export function Card({
  card,
  theme = freeTheme,
  faceDown = false,
  selected = false,
  disableTransitions = false,
  onClick,
  className = "",
  ref,
}: CardProps) {
  const base: CSSProperties = {
    aspectRatio: "5 / 7",
    containerType: "inline-size",
    borderRadius: "6%",
    fontFamily: theme.font?.family,
    ...buildBorderStyle(theme),
  };

  const cls = [
    "relative select-none overflow-hidden",
    !disableTransitions && "transition-transform duration-150",
    !disableTransitions && onClick && "hover:-translate-y-1 active:scale-95",
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
        backgroundColor: theme.back.artwork ? undefined : theme.back.color,
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
    >
      {content}
    </div>
  );
}
