"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { GameBoard } from "@/components/board/GameBoard";
import { Hand } from "@/components/board/Hand";
import { PlayArea } from "@/components/board/PlayArea";
import { TierBadge } from "@/components/ui/TierBadge";
import { Link } from "@/i18n/navigation";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme as defaultBoard } from "@/lib/board/themes/green_felt";
import type { TableCard } from "@/lib/board/types";
import { THEMES } from "@/lib/card/themes";
import { freeTheme as defaultDeck } from "@/lib/card/themes/free";
import type { CardDescriptor } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";

const SAMPLE_HAND: CardDescriptor[] = [
    { type: "suited", suit: "spades", rank: "A" },
    { type: "suited", suit: "hearts", rank: "K" },
    { type: "suited", suit: "diamonds", rank: "Q" },
    { type: "suited", suit: "clubs", rank: "J" },
    { type: "suited", suit: "spades", rank: "10" },
];

const OPPONENT_CARDS: CardDescriptor[] = [
    { type: "suited", suit: "hearts", rank: "7" },
    { type: "suited", suit: "clubs", rank: "A" },
    { type: "suited", suit: "diamonds", rank: "9" },
    { type: "suited", suit: "spades", rank: "Q" },
    { type: "suited", suit: "hearts", rank: "2" },
];

const INITIAL_TABLE: TableCard[] = [
    {
        id: "demo-self",
        card: { type: "suited", suit: "diamonds", rank: "5" },
        playerId: "current",
    },
    {
        id: "demo-opponent",
        card: { type: "suited", suit: "clubs", rank: "8" },
        playerId: "opponent-1",
    },
];

const TABLE_LIMIT = 6;

const OPPONENT_REPLY_DELAY_MS = 650;
const HAND_REFILL_DELAY_MS = 1200;

type Props = {
    deckId: string;
    boardId: string;
    backHref: string;
};

export function PreviewPage({ deckId, boardId, backHref }: Props) {
    "use no memo";
    const t = useTranslations("preview");
    const cardTheme = THEMES[deckId] ?? defaultDeck;
    const boardTheme = BOARD_THEMES[boardId] ?? defaultBoard;
    const opponentDeckId = deckId === "creator" ? "free" : "creator";

    const [hand, setHand] = useState(SAMPLE_HAND);
    const [table, setTable] = useState(INITIAL_TABLE);
    const playCount = useRef(0);
    const replyCount = useRef(0);
    const timers = useRef<number[]>([]);

    useEffect(() => {
        const pending = timers.current;
        return () => {
            for (const timer of pending) clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        if (hand.length > 0) return;
        const timer = window.setTimeout(
            () => setHand(SAMPLE_HAND),
            HAND_REFILL_DELAY_MS,
        );
        timers.current.push(timer);
        return () => clearTimeout(timer);
    }, [hand.length]);

    function playCard(card: CardDescriptor) {
        playCount.current += 1;
        setHand((cards) => cards.filter((c) => cardKey(c) !== cardKey(card)));
        setTable((cards) =>
            [
                ...cards,
                {
                    id: `self-${playCount.current}`,
                    card,
                    playerId: "current",
                },
            ].slice(-TABLE_LIMIT),
        );

        const timer = window.setTimeout(() => {
            const reply =
                OPPONENT_CARDS[replyCount.current % OPPONENT_CARDS.length];
            replyCount.current += 1;
            setTable((cards) =>
                [
                    ...cards,
                    {
                        id: `opponent-${replyCount.current}`,
                        card: reply,
                        playerId: "opponent-1",
                    },
                ].slice(-TABLE_LIMIT),
            );
        }, OPPONENT_REPLY_DELAY_MS);
        timers.current.push(timer);
    }

    const players = [
        {
            userId: "opponent-1",
            username: t("opponent_name"),
            deckStyleId: opponentDeckId,
            isCurrentPlayer: false,
        },
        {
            userId: "current",
            username: t("you"),
            deckStyleId: deckId,
            isCurrentPlayer: true,
        },
    ];

    const handArea = (
        <div className="flex w-full min-w-0 flex-col items-center gap-1">
            <Hand cards={hand} theme={cardTheme} onPlay={playCard} />
            <span
                className="text-xs font-semibold"
                style={{ color: boardTheme.badge.textColor, opacity: 0.5 }}
            >
                {t("play_hint")}
            </span>
        </div>
    );

    const playArea = <PlayArea cards={table} players={players} />;

    return (
        <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-screen bg-wc-surface">
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
                    {t("back")}
                </Link>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] text-wc-sub uppercase tracking-wider">
                            {t("cards")}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-wc-text">
                                {cardTheme.name}
                            </span>
                            <TierBadge
                                tier={cardTheme.tier}
                                name={cardTheme.tier}
                            />
                        </div>
                    </div>
                    <div
                        className="w-px h-8 self-center"
                        style={{ background: "rgba(255,255,255,0.10)" }}
                    />
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] text-wc-sub uppercase tracking-wider">
                            {t("board")}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-wc-text">
                                {boardTheme.name}
                            </span>
                            <TierBadge
                                tier={boardTheme.tier}
                                name={boardTheme.tier}
                            />
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
