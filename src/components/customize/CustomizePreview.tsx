"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameTable } from "@/components/game/GameTable";
import { TierBadge } from "@/components/ui/TierBadge";
import { Link } from "@/i18n/navigation";
import { getBoardTheme } from "@/lib/board/themes";
import { getCardTheme } from "@/lib/card/themes";
import {
    isPreviewPlay,
    PREVIEW_OPPONENT,
    PREVIEW_SELF,
    type PreviewCard,
    type PreviewView,
    previewTable,
} from "@/lib/customize/previewTable";
import type { GameAction } from "@/lib/engine/types";
import type { GameClientPayload } from "@/lib/models/game";

function own(id: string, card: PreviewCard["card"], ownerId: string) {
    return { id, card, ownerId };
}

const SAMPLE_HAND: readonly PreviewCard[] = [
    own("h-sA", { type: "suited", suit: "spades", rank: "A" }, PREVIEW_SELF),
    own("h-hK", { type: "suited", suit: "hearts", rank: "K" }, PREVIEW_SELF),
    own("h-dQ", { type: "suited", suit: "diamonds", rank: "Q" }, PREVIEW_SELF),
    own("h-cJ", { type: "suited", suit: "clubs", rank: "J" }, PREVIEW_SELF),
    own("h-s10", { type: "suited", suit: "spades", rank: "10" }, PREVIEW_SELF),
];

const OPPONENT_CARDS: readonly PreviewCard["card"][] = [
    { type: "suited", suit: "hearts", rank: "7" },
    { type: "suited", suit: "clubs", rank: "A" },
    { type: "suited", suit: "diamonds", rank: "9" },
    { type: "suited", suit: "spades", rank: "Q" },
    { type: "suited", suit: "hearts", rank: "2" },
];

const INITIAL_TRICK: readonly PreviewCard[] = [
    own(
        "t-self",
        { type: "suited", suit: "diamonds", rank: "5" },
        PREVIEW_SELF,
    ),
    own(
        "t-opponent",
        { type: "suited", suit: "clubs", rank: "8" },
        PREVIEW_OPPONENT,
    ),
];

const TRICK_LIMIT = 6;
const OPPONENT_HAND = 5;
const OPPONENT_REPLY_DELAY_MS = 650;
const HAND_REFILL_DELAY_MS = 1200;
const noop = () => {};

type Props = {
    deckId: string;
    boardId: string;
    backHref: string;
};

export function CustomizePreview({ deckId, boardId, backHref }: Props) {
    const t = useTranslations("preview");
    const cardTheme = getCardTheme(deckId);
    const boardTheme = getBoardTheme(boardId);
    const opponentDeckId = deckId === "creator" ? "free" : "creator";

    const [hand, setHand] = useState(SAMPLE_HAND);
    const [trick, setTrick] = useState(INITIAL_TRICK);
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

    const onAction = useCallback((action: GameAction) => {
        if (!isPreviewPlay(action)) return;
        const played = SAMPLE_HAND.find((c) => c.id === action.cardId);
        if (!played) return;
        playCount.current += 1;
        const selfId = `self-${playCount.current}`;
        setHand((cards) => cards.filter((c) => c.id !== played.id));
        setTrick((cards) =>
            [...cards, own(selfId, played.card, PREVIEW_SELF)].slice(
                -TRICK_LIMIT,
            ),
        );

        const timer = window.setTimeout(() => {
            const reply =
                OPPONENT_CARDS[replyCount.current % OPPONENT_CARDS.length];
            replyCount.current += 1;
            const replyId = `opponent-${replyCount.current}`;
            setTrick((cards) =>
                [...cards, own(replyId, reply, PREVIEW_OPPONENT)].slice(
                    -TRICK_LIMIT,
                ),
            );
        }, OPPONENT_REPLY_DELAY_MS);
        timers.current.push(timer);
    }, []);

    const players = useMemo(
        () => [
            {
                userId: PREVIEW_OPPONENT,
                username: t("opponent_name"),
                seat: 0,
                deckStyleId: opponentDeckId,
            },
            {
                userId: PREVIEW_SELF,
                username: t("you"),
                seat: 1,
                deckStyleId: deckId,
            },
        ],
        [t, deckId, opponentDeckId],
    );
    const hint = t("play_hint");
    const payload: GameClientPayload = useMemo(() => {
        const view: PreviewView = {
            hand,
            trick,
            opponentHand: OPPONENT_HAND,
            hint,
        };
        return {
            gameId: "preview",
            moduleId: "preview",
            roomCode: null,
            version: 0,
            phase: "play",
            isOver: false,
            currentPlayerId: PREVIEW_SELF,
            view,
            legalActions: [],
            outcome: null,
            end: null,
            players,
            botIds: [],
            log: [],
            viewerId: PREVIEW_SELF,
        };
    }, [hand, trick, hint, players]);

    return (
        // Mobile: subtract the sticky AppNav header (h-14 + 3px border) and the
        // AppShell's pb-20 reserved for the bottom nav.
        <div className="flex h-[calc(100dvh-8.5rem-3px)] flex-col bg-wc-bg md:h-screen">
            <div
                className="flex shrink-0 items-center justify-between px-4 py-3"
                style={{
                    borderBottom: "2px solid var(--edge)",
                    background: "var(--panel-d)",
                }}
            >
                <Link
                    href={backHref}
                    className="flex items-center gap-2 font-display text-sm"
                    style={{ color: "var(--muted)" }}
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
                        <span className="text-wc-label text-wc-sub uppercase tracking-wider">
                            {t("cards")}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-wc-text">
                                {cardTheme.name}
                            </span>
                            <TierBadge tier={cardTheme.tier} />
                        </div>
                    </div>
                    <div
                        className="w-px h-8 self-center"
                        style={{ background: "rgba(255,255,255,0.10)" }}
                    />
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-wc-label text-wc-sub uppercase tracking-wider">
                            {t("board")}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-wc-text">
                                {boardTheme.name}
                            </span>
                            <TierBadge tier={boardTheme.tier} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 xl:px-10">
                <GameTable
                    table={previewTable}
                    payload={payload}
                    currentUserId={PREVIEW_SELF}
                    deckTheme={cardTheme}
                    boardTheme={boardTheme}
                    pending={false}
                    onAction={onAction}
                    onIllegal={noop}
                />
            </div>
        </div>
    );
}
