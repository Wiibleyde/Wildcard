"use client";

import Link from "next/link";
import { GameBoard } from "@/components/board/GameBoard";
import { Card } from "@/components/card/Card";
import { TierBadge } from "@/components/ui/TierBadge";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme as defaultBoard } from "@/lib/board/themes/green_felt";
import { THEMES } from "@/lib/card/themes";
import { freeTheme as defaultDeck } from "@/lib/card/themes/free";
import type { CardDescriptor } from "@/lib/card/types";

const SAMPLE_HAND: CardDescriptor[] = [
  { type: "suited", suit: "spades", rank: "A" },
  { type: "suited", suit: "hearts", rank: "K" },
  { type: "suited", suit: "diamonds", rank: "Q" },
  { type: "suited", suit: "clubs", rank: "J" },
  { type: "suited", suit: "spades", rank: "10" },
];

const PLAY_AREA_CARDS: CardDescriptor[] = [
  { type: "suited", suit: "hearts", rank: "7" },
  { type: "suited", suit: "clubs", rank: "A" },
];

type Props = {
  deckId: string;
  boardId: string;
  backHref: string;
};

export function PreviewPage({ deckId, boardId, backHref }: Props) {
  const cardTheme = THEMES[deckId] ?? defaultDeck;
  const boardTheme = BOARD_THEMES[boardId] ?? defaultBoard;

  const handArea = (
    <div className="flex items-end justify-center gap-1 flex-wrap py-1">
      {SAMPLE_HAND.map((card) => (
        <div
          key={`${card.type}-${"suit" in card ? card.suit : ""}-${"rank" in card ? card.rank : ""}`}
          className="w-14"
        >
          <Card card={card} theme={cardTheme} />
        </div>
      ))}
    </div>
  );

  const playArea = (
    <div className="flex items-center justify-center gap-3">
      <div className="w-14">
        <Card card={PLAY_AREA_CARDS[0]} theme={cardTheme} faceDown />
      </div>
      <div className="w-14">
        <Card card={PLAY_AREA_CARDS[0]} theme={cardTheme} />
      </div>
      <div className="w-14">
        <Card card={PLAY_AREA_CARDS[1]} theme={cardTheme} />
      </div>
    </div>
  );

  const players = [
    {
      userId: "opponent-1",
      username: "Joueur 2",
      deckStyleId: deckId,
      isCurrentPlayer: false,
    },
    {
      userId: "current",
      username: "Vous",
      deckStyleId: deckId,
      isCurrentPlayer: true,
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-wc-surface">
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <Link
          href={backHref}
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: "#7c8699" }}
        >
          <svg
            viewBox="0 0 20 20"
            className="w-4 h-4"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          Retour
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-wc-sub uppercase tracking-wider">
              Cartes
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-wc-text">
                {cardTheme.name}
              </span>
              <TierBadge tier={cardTheme.tier} name={cardTheme.tier} />
            </div>
          </div>
          <div
            className="w-px h-8 self-center"
            style={{ background: "rgba(255,255,255,0.10)" }}
          />
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-wc-sub uppercase tracking-wider">
              Plateau
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-wc-text">
                {boardTheme.name}
              </span>
              <TierBadge tier={boardTheme.tier} name={boardTheme.tier} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 min-h-0">
        <GameBoard
          theme={boardTheme}
          players={players}
          playArea={playArea}
          handArea={handArea}
        />
      </div>
    </div>
  );
}
