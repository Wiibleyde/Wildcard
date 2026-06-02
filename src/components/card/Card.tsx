"use client";

import type { CSSProperties } from "react";
import { PIP_LAYOUTS, type PipPosition } from "@/lib/card/pips";
import { freeTheme } from "@/lib/card/themes/free";
import type { CardTheme, Rank, Suit } from "@/lib/card/types";

export interface CardProps {
  suit: Suit;
  rank: Rank;
  theme?: CardTheme;
  /** Render the card back instead of its face */
  faceDown?: boolean;
  /** Lift the card upward (e.g. when selected in hand) */
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const RANK_TO_NUMBER: Partial<Record<string, number>> = {
  A: 1,
  J: 11,
  Q: 12,
  K: 13,
};

function toNumber(rank: Rank): number {
  return RANK_TO_NUMBER[rank] ?? Number.parseInt(rank, 10);
}

function buildBorderStyle(theme: CardTheme): CSSProperties {
  if (theme.border.effect === "glow" && theme.border.glowColor) {
    const spread = theme.border.glowSize ?? 8;
    return {
      border: `2px solid ${theme.border.color}`,
      boxShadow: `0 0 ${spread}px ${Math.round(spread / 3)}px ${theme.border.glowColor}`,
    };
  }
  return { border: `2px solid ${theme.border.color}` };
}

export function Card({
  suit,
  rank,
  theme = freeTheme,
  faceDown = false,
  selected = false,
  onClick,
  className = "",
}: CardProps) {
  const suitStyle = theme.suits[suit];
  const num = toNumber(rank);
  const pipLayout = PIP_LAYOUTS[num];
  const isFaceCard = rank === "J" || rank === "Q" || rank === "K";
  const isAce = rank === "A";

  const sharedStyle: CSSProperties = {
    aspectRatio: "5 / 7",
    // Enables cqi units on children — they resolve relative to this card's width
    containerType: "inline-size",
    borderRadius: "6%",
    ...buildBorderStyle(theme),
  };

  const sharedClass = [
    "relative select-none overflow-hidden transition-transform duration-150",
    onClick ? "cursor-pointer hover:-translate-y-1 active:scale-95" : "",
    selected ? "-translate-y-3" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const backStyle: CSSProperties = {
    ...sharedStyle,
    background: theme.backPattern ?? theme.backColor,
    backgroundColor: theme.backColor,
  };

  const faceStyle: CSSProperties = {
    ...sharedStyle,
    backgroundColor: theme.backgroundColor,
  };

  const body = faceDown ? null : (
    <>
      <Corner rank={rank} symbol={suitStyle.symbol} color={suitStyle.color} />
      <CardBody
        isAce={isAce}
        isFaceCard={isFaceCard}
        pipLayout={pipLayout}
        rank={rank}
        suitStyle={suitStyle}
      />
      <Corner
        rank={rank}
        symbol={suitStyle.symbol}
        color={suitStyle.color}
        flipped
      />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={sharedClass}
        style={faceDown ? backStyle : faceStyle}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={sharedClass} style={faceDown ? backStyle : faceStyle}>
      {body}
    </div>
  );
}

// ── Internal sub-components ──────────────────────────────────────────────────

interface CornerProps {
  rank: Rank;
  symbol: string;
  color: string;
  flipped?: boolean;
}

function Corner({ rank, symbol, color, flipped = false }: CornerProps) {
  return (
    <div
      className={`absolute flex flex-col items-center${flipped ? " rotate-180" : ""}`}
      style={{
        ...(flipped
          ? { bottom: "4%", right: "6%" }
          : { top: "4%", left: "6%" }),
        color,
        lineHeight: 1.1,
      }}
    >
      <span style={{ fontSize: "13cqi", fontWeight: 700 }}>{rank}</span>
      <span style={{ fontSize: "11cqi" }}>{symbol}</span>
    </div>
  );
}

interface CardBodyProps {
  isAce: boolean;
  isFaceCard: boolean;
  pipLayout: PipPosition[] | undefined;
  rank: Rank;
  suitStyle: { symbol: string; color: string };
}

function CardBody({
  isAce,
  isFaceCard,
  pipLayout,
  rank,
  suitStyle,
}: CardBodyProps) {
  return (
    <div
      className="absolute"
      style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
    >
      {isAce && (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ fontSize: "46cqi", color: suitStyle.color, lineHeight: 1 }}
        >
          {suitStyle.symbol}
        </div>
      )}

      {isFaceCard && (
        <div
          className="w-full h-full flex flex-col items-center justify-center"
          style={{ color: suitStyle.color, gap: "5%" }}
        >
          <span style={{ fontSize: "33cqi", fontWeight: 700, lineHeight: 1 }}>
            {rank}
          </span>
          <span style={{ fontSize: "24cqi", lineHeight: 1 }}>
            {suitStyle.symbol}
          </span>
        </div>
      )}

      {pipLayout && (
        <div className="relative w-full h-full">
          {pipLayout.map((pip, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: pip order is stable by card value
              key={i}
              className="absolute"
              style={{
                left: `${pip.x}%`,
                top: `${pip.y}%`,
                fontSize: "15cqi",
                color: suitStyle.color,
                lineHeight: 1,
                transform: `translate(-50%, -50%)${pip.flip ? " rotate(180deg)" : ""}`,
              }}
            >
              {suitStyle.symbol}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
