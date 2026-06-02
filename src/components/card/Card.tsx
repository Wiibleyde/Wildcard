"use client";

import type { CSSProperties, ReactElement, Ref } from "react";
import { PIP_LAYOUTS, type PipPosition } from "@/lib/card/pips";
import { freeTheme } from "@/lib/card/themes/free";
import type {
  CardDescriptor,
  CardTheme,
  FaceRank,
  Rank,
  TrumpIndex,
} from "@/lib/card/types";

const ROMAN: Record<TrumpIndex, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
  12: "XII",
  13: "XIII",
  14: "XIV",
  15: "XV",
  16: "XVI",
  17: "XVII",
  18: "XVIII",
  19: "XIX",
  20: "XX",
  21: "XXI",
};

const RANK_TO_NUMBER: Partial<Record<string, number>> = {
  A: 1,
  J: 11,
  C: 12, // Cavalier
  Q: 13,
  K: 14,
};

function rankToNumber(rank: Rank): number {
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

export interface CardProps {
  card: CardDescriptor;
  theme?: CardTheme;
  /** Render the card back instead of its face */
  faceDown?: boolean;
  /** Lift the card upward via CSS transform (only when disableTransitions is false) */
  selected?: boolean;
  /**
   * Strip all CSS transitions and transform classes from the root element.
   * Set to true whenever GSAP (or a D&D library) will drive this card's
   * position/transform — prevents CSS and JS animations from fighting.
   */
  disableTransitions?: boolean;
  onClick?: () => void;
  className?: string;
  /**
   * Ref forwarded to the root DOM element (div or button).
   * Required for GSAP timeline targets: useRef<HTMLElement>(null)
   */
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
  const sharedStyle: CSSProperties = {
    aspectRatio: "5 / 7",
    // Enables cqi units on children — they resolve relative to this card's width
    containerType: "inline-size",
    borderRadius: "6%",
    ...buildBorderStyle(theme),
  };

  const sharedClass = [
    "relative select-none overflow-hidden",
    !disableTransitions && "transition-transform duration-150",
    !disableTransitions && onClick && "hover:-translate-y-1 active:scale-95",
    !disableTransitions && selected && "-translate-y-3",
    onClick ? "cursor-pointer" : "",
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

  const content = faceDown ? null : <CardContent card={card} theme={theme} />;

  if (onClick) {
    return (
      <button
        // HTMLButtonElement extends HTMLElement — safe cast
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        className={sharedClass}
        style={faceDown ? backStyle : faceStyle}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      // HTMLDivElement extends HTMLElement — safe cast
      ref={ref as Ref<HTMLDivElement>}
      className={sharedClass}
      style={faceDown ? backStyle : faceStyle}
    >
      {content}
    </div>
  );
}

// ── Content dispatcher ────────────────────────────────────────────────────────

function CardContent({
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

// ── Suited card (standard, 32-card, tarot suited) ────────────────────────────

function SuitedContent({
  card,
  theme,
}: {
  card: Extract<CardDescriptor, { type: "suited" }>;
  theme: CardTheme;
}) {
  const { suit, rank } = card;
  const suitStyle = theme.suits[suit];
  const num = rankToNumber(rank);
  const pipLayout = PIP_LAYOUTS[num];
  const isFaceCard =
    rank === "J" || rank === "C" || rank === "Q" || rank === "K";
  const isAce = rank === "A";

  const faceRank = isAce || isFaceCard ? (rank as FaceRank) : undefined;
  const customArtwork = faceRank
    ? theme.faceArtwork?.[suit]?.[faceRank]
    : undefined;

  return (
    <>
      <Corner label={rank} sub={suitStyle.symbol} color={suitStyle.color} />
      <SuitedBody
        isAce={isAce}
        isFaceCard={isFaceCard}
        rank={rank}
        suitStyle={suitStyle}
        pipLayout={pipLayout}
        customArtwork={customArtwork}
      />
      <Corner
        label={rank}
        sub={suitStyle.symbol}
        color={suitStyle.color}
        flipped
      />
    </>
  );
}

interface SuitedBodyProps {
  isAce: boolean;
  isFaceCard: boolean;
  rank: Rank;
  suitStyle: { symbol: string | ReactElement; color: string };
  pipLayout: PipPosition[] | undefined;
  customArtwork: string | ReactElement | undefined;
}

function SuitedBody({
  isAce,
  isFaceCard,
  rank,
  suitStyle,
  pipLayout,
  customArtwork,
}: SuitedBodyProps) {
  return (
    <div
      className="absolute"
      style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
    >
      {customArtwork !== undefined && (
        <CenteredArtwork artwork={customArtwork} color={suitStyle.color} />
      )}

      {customArtwork === undefined && isAce && (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ fontSize: "46cqi", color: suitStyle.color, lineHeight: 1 }}
        >
          {suitStyle.symbol}
        </div>
      )}

      {customArtwork === undefined && isFaceCard && (
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

// ── Trump card (tarot atouts I–XXI) ──────────────────────────────────────────

function TrumpContent({
  index,
  theme,
}: {
  index: TrumpIndex;
  theme: CardTheme;
}) {
  const color = theme.trumpColor ?? theme.textColor;
  const artwork = theme.trumpArtwork?.[index];

  return (
    <>
      <Corner label={String(index)} color={color} />
      <div
        className="absolute"
        style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
      >
        {artwork !== undefined ? (
          <CenteredArtwork artwork={artwork} color={color} />
        ) : (
          // Default: large arabic number + roman numeral as subtitle
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{ color, gap: "4%" }}
          >
            <span style={{ fontSize: "38cqi", fontWeight: 700, lineHeight: 1 }}>
              {index}
            </span>
            <span style={{ fontSize: "11cqi", lineHeight: 1, opacity: 0.5 }}>
              {ROMAN[index]}
            </span>
          </div>
        )}
      </div>
      <Corner label={String(index)} color={color} flipped />
    </>
  );
}

// ── Fool card (tarot L'Excuse) ────────────────────────────────────────────────

function FoolContent({ theme }: { theme: CardTheme }) {
  const color = theme.trumpColor ?? theme.textColor;

  return (
    <>
      <Corner label="★" color={color} />
      <div
        className="absolute"
        style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
      >
        {theme.foolArtwork !== undefined ? (
          <CenteredArtwork artwork={theme.foolArtwork} color={color} />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ fontSize: "46cqi", color, lineHeight: 1 }}
          >
            ★
          </div>
        )}
      </div>
      <Corner label="★" color={color} flipped />
    </>
  );
}

// ── Joker card ────────────────────────────────────────────────────────────────

function JokerContent({
  variant,
  theme,
}: {
  variant: "red" | "black" | undefined;
  theme: CardTheme;
}) {
  const color =
    variant === "red" ? theme.suits.hearts.color : theme.suits.spades.color;
  const artwork = variant ? theme.jokerArtwork?.[variant] : undefined;

  return (
    <>
      <Corner label="★" color={color} />
      <div
        className="absolute"
        style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
      >
        {artwork !== undefined ? (
          <CenteredArtwork artwork={artwork} color={color} />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ fontSize: "46cqi", color, lineHeight: 1 }}
          >
            ★
          </div>
        )}
      </div>
      <Corner label="★" color={color} flipped />
    </>
  );
}

// ── Shared utilities ──────────────────────────────────────────────────────────

function CenteredArtwork({
  artwork,
  color,
}: {
  artwork: string | ReactElement;
  color: string;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      {typeof artwork === "string" ? (
        <span style={{ fontSize: "46cqi", color, lineHeight: 1 }}>
          {artwork}
        </span>
      ) : (
        artwork
      )}
    </div>
  );
}

interface CornerProps {
  label: string | ReactElement;
  sub?: string | ReactElement;
  color: string;
  flipped?: boolean;
}

function Corner({ label, sub, color, flipped = false }: CornerProps) {
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
      <span style={{ fontSize: "13cqi", fontWeight: 700 }}>{label}</span>
      {sub !== undefined && <span style={{ fontSize: "11cqi" }}>{sub}</span>}
    </div>
  );
}
