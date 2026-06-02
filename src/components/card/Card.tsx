"use client";

import type { CSSProperties, ReactElement, Ref } from "react";
import { PIP_LAYOUTS, type PipPosition } from "@/lib/card/pips";
import { freeTheme } from "@/lib/card/themes/free";
import type {
  CardArtwork,
  CardDescriptor,
  CardTheme,
  FaceRank,
  Rank,
  SuitStyle,
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
  C: 12,
  Q: 13,
  K: 14,
};

function rankToNumber(rank: Rank): number {
  return RANK_TO_NUMBER[rank] ?? Number.parseInt(rank, 10);
}

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

function effectsAttr(theme: CardTheme): string | undefined {
  const types = theme.effects?.map((e) => e.type);
  return types?.length ? types.join(" ") : undefined;
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
   * Set to true whenever GSAP (or a D&D library) drives this card's position —
   * prevents CSS and JS animations from fighting.
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
  const sharedStyle: CSSProperties = {
    aspectRatio: "5 / 7",
    containerType: "inline-size",
    borderRadius: "6%",
    fontFamily: theme.font?.family,
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
    background: theme.back.artwork
      ? undefined
      : (theme.back.pattern ?? theme.back.color),
    backgroundColor: theme.back.artwork ? undefined : theme.back.color,
  };

  const faceStyle: CSSProperties = {
    ...sharedStyle,
    backgroundColor: theme.backgroundColor,
  };

  const content = faceDown ? (
    <BackContent theme={theme} />
  ) : (
    <CardContent card={card} theme={theme} />
  );

  if (onClick) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        className={sharedClass}
        style={faceDown ? backStyle : faceStyle}
        data-card-effect={faceDown ? undefined : effectsAttr(theme)}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      className={sharedClass}
      style={faceDown ? backStyle : faceStyle}
      data-card-effect={faceDown ? undefined : effectsAttr(theme)}
    >
      {content}
    </div>
  );
}

// ── Back ──────────────────────────────────────────────────────────────────────

function BackContent({ theme }: { theme: CardTheme }) {
  const { back } = theme;

  return (
    <>
      {back.artwork && (
        <div className="absolute inset-0">
          {typeof back.artwork === "string" ? (
            // biome-ignore lint/performance/noImgElement: theme artwork — Next Image requires known dimensions
            <img
              src={back.artwork}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            back.artwork
          )}
        </div>
      )}
      {back.emblem && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {typeof back.emblem === "string" ? (
            <span style={{ fontSize: "30cqi", lineHeight: 1 }}>
              {back.emblem}
            </span>
          ) : (
            back.emblem
          )}
        </div>
      )}
    </>
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

// ── Artwork fill layer ────────────────────────────────────────────────────────

function ArtworkFill({ artwork }: { artwork: CardArtwork }) {
  const { fill, objectFit = "cover", tint } = artwork;
  if (!fill) return null;

  return (
    <div className="absolute inset-0">
      {typeof fill === "string" ? (
        // biome-ignore lint/performance/noImgElement: theme artwork — Next Image requires known dimensions
        <img
          src={fill}
          alt=""
          className="w-full h-full"
          style={{ objectFit }}
        />
      ) : (
        <div className="w-full h-full">{fill}</div>
      )}
      {tint && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: tint }}
        />
      )}
    </div>
  );
}

// ── Suited card ───────────────────────────────────────────────────────────────

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

  const artwork =
    theme.artwork?.suited?.[suit]?.[rank] ?? theme.artwork?.suitDefault?.[suit];

  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  // Center illustration: theme override → default face/ace/pip render
  const centerArtwork = artwork?.center;
  const faceRank = isAce || isFaceCard ? (rank as FaceRank) : undefined;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && (
        <Corner
          label={rank}
          sub={suitStyle.symbol}
          color={suitStyle.color}
          font={theme.font}
        />
      )}
      {showCenter && (
        <SuitedBody
          isAce={isAce}
          isFaceCard={isFaceCard}
          rank={rank}
          faceRank={faceRank}
          suitStyle={suitStyle}
          pipLayout={pipLayout}
          centerArtwork={centerArtwork}
        />
      )}
      {showCorners && (
        <Corner
          label={rank}
          sub={suitStyle.symbol}
          color={suitStyle.color}
          font={theme.font}
          flipped
        />
      )}
    </>
  );
}

interface SuitedBodyProps {
  isAce: boolean;
  isFaceCard: boolean;
  rank: Rank;
  faceRank: FaceRank | undefined;
  suitStyle: SuitStyle;
  pipLayout: PipPosition[] | undefined;
  centerArtwork: string | ReactElement | undefined;
}

function SuitedBody({
  isAce,
  isFaceCard,
  rank,
  suitStyle,
  pipLayout,
  centerArtwork,
}: SuitedBodyProps) {
  return (
    <div
      className="absolute"
      style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
    >
      {centerArtwork !== undefined && (
        <CenteredArtwork artwork={centerArtwork} color={suitStyle.color} />
      )}

      {centerArtwork === undefined && isAce && (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            fontSize: "46cqi",
            color: suitStyle.color,
            lineHeight: 1,
            ...suitStyle.symbolStyle,
          }}
        >
          {suitStyle.symbol}
        </div>
      )}

      {centerArtwork === undefined && isFaceCard && (
        <div
          className="w-full h-full flex flex-col items-center justify-center"
          style={{ color: suitStyle.color, gap: "5%" }}
        >
          <span style={{ fontSize: "33cqi", fontWeight: 700, lineHeight: 1 }}>
            {rank}
          </span>
          <span
            style={{
              fontSize: "24cqi",
              lineHeight: 1,
              ...suitStyle.symbolStyle,
            }}
          >
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
                ...suitStyle.symbolStyle,
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
  const artwork = theme.artwork?.trump?.[index];
  const centerArtwork = artwork?.center;
  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && (
        <Corner label={String(index)} color={color} font={theme.font} />
      )}
      {showCenter && (
        <div
          className="absolute"
          style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
        >
          {centerArtwork !== undefined ? (
            <CenteredArtwork artwork={centerArtwork} color={color} />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{ color, gap: "4%" }}
            >
              <span
                style={{ fontSize: "38cqi", fontWeight: 700, lineHeight: 1 }}
              >
                {index}
              </span>
              <span style={{ fontSize: "11cqi", lineHeight: 1, opacity: 0.5 }}>
                {ROMAN[index]}
              </span>
            </div>
          )}
        </div>
      )}
      {showCorners && (
        <Corner label={String(index)} color={color} font={theme.font} flipped />
      )}
    </>
  );
}

// ── Fool card (tarot L'Excuse) ────────────────────────────────────────────────

function FoolContent({ theme }: { theme: CardTheme }) {
  const color = theme.trumpColor ?? theme.textColor;
  const artwork = theme.artwork?.fool;
  const centerArtwork = artwork?.center;
  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && <Corner label="★" color={color} font={theme.font} />}
      {showCenter && (
        <div
          className="absolute"
          style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
        >
          {centerArtwork !== undefined ? (
            <CenteredArtwork artwork={centerArtwork} color={color} />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ fontSize: "46cqi", color, lineHeight: 1 }}
            >
              ★
            </div>
          )}
        </div>
      )}
      {showCorners && (
        <Corner label="★" color={color} font={theme.font} flipped />
      )}
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
  const artwork = variant ? theme.artwork?.joker?.[variant] : undefined;
  const centerArtwork = artwork?.center;
  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && <Corner label="★" color={color} font={theme.font} />}
      {showCenter && (
        <div
          className="absolute"
          style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
        >
          {centerArtwork !== undefined ? (
            <CenteredArtwork artwork={centerArtwork} color={color} />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ fontSize: "46cqi", color, lineHeight: 1 }}
            >
              ★
            </div>
          )}
        </div>
      )}
      {showCorners && (
        <Corner label="★" color={color} font={theme.font} flipped />
      )}
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
  font?: CardTheme["font"];
  flipped?: boolean;
}

function Corner({ label, sub, color, font, flipped = false }: CornerProps) {
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
      <span
        style={{
          fontSize: "13cqi",
          fontWeight: font?.rankWeight ?? 700,
          fontStyle: font?.rankItalic ? "italic" : undefined,
          ...font?.rankStyle,
        }}
      >
        {label}
      </span>
      {sub !== undefined && <span style={{ fontSize: "11cqi" }}>{sub}</span>}
    </div>
  );
}
