"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { Card } from "@/components/card/Card";
import type { BoardPlayer, TableCard } from "@/lib/board/types";
import { getPlayAnimation, prefersReducedMotion } from "@/lib/card/animations";
import { CARD_WIDTH_CLASS, type CardSize } from "@/lib/card/sizes";
import { getCardTheme } from "@/lib/card/themes";

/**
 * Deterministic tilt in [-5°, +5°] derived from the card id — gives the
 * "thrown on the table" look while staying identical between server and
 * client renders (no hydration mismatch).
 */
function tableTilt(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 11) - 5;
}

export interface PlayAreaProps {
    cards: TableCard[];
    /** Seats — each table card resolves to its owner's deck style and name */
    players: BoardPlayer[];
    size?: CardSize;
    /** Shown when no card has been played yet */
    emptyHint?: string;
}

/**
 * Cards currently on the table. Every card is rendered in the deck style of
 * the player who played it (so a table mixes styles), and enters with that
 * deck's play-animation template.
 */
export function PlayArea({
    cards,
    players,
    size = "md",
    emptyHint,
}: PlayAreaProps) {
    const scopeRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef(new Map<string, HTMLDivElement>());
    const animatedIds = useRef(new Set<string>());

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            for (const tableCard of cards) {
                if (animatedIds.current.has(tableCard.id)) continue;
                animatedIds.current.add(tableCard.id);
                const el = cardRefs.current.get(tableCard.id);
                if (!el) continue;
                const owner = players.find(
                    (p) => p.userId === tableCard.playerId,
                );
                const theme = getCardTheme(owner?.deckStyleId);
                getPlayAnimation(theme.playAnimation).animate(el, {
                    origin: owner?.isCurrentPlayer ? "self" : "opponent",
                    duration: theme.playAnimation?.duration,
                });
            }
        },
        { dependencies: [cards, players], scope: scopeRef },
    );

    return (
        <div
            ref={scopeRef}
            className="flex flex-wrap items-center justify-center gap-3 px-2 py-3"
        >
            {cards.length === 0 && emptyHint && (
                <span className="text-sm text-white/40">{emptyHint}</span>
            )}
            {cards.map((tableCard) => {
                const owner = players.find(
                    (p) => p.userId === tableCard.playerId,
                );
                return (
                    <div
                        key={tableCard.id}
                        ref={(el) => {
                            if (el) cardRefs.current.set(tableCard.id, el);
                            else cardRefs.current.delete(tableCard.id);
                        }}
                        className={`${CARD_WIDTH_CLASS[size]} will-change-transform`}
                    >
                        <div
                            style={{
                                transform: `rotate(${tableTilt(tableCard.id)}deg)`,
                            }}
                        >
                            <Card
                                card={tableCard.card}
                                theme={getCardTheme(owner?.deckStyleId)}
                                disableTransitions
                            />
                        </div>
                        {owner && (
                            <p className="mt-1 truncate text-center text-[10px] font-semibold text-white/60">
                                {owner.username}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
