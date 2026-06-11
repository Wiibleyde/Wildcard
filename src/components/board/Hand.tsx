"use client";

import { Card } from "@/components/card/Card";
import {
    CARD_WIDTH_CLASS,
    type CardSize,
    HAND_OVERLAP_CLASS,
} from "@/lib/card/sizes";
import type { CardDescriptor, CardTheme } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";

export interface HandProps {
    cards: CardDescriptor[];
    /** The viewer's own deck theme — a hand always renders in it */
    theme: CardTheme;
    /** Called when the viewer clicks a card to play it */
    onPlay?: (card: CardDescriptor) => void;
    size?: CardSize;
    /** Block plays (not the viewer's turn) while keeping the hand visible */
    disabled?: boolean;
}

/**
 * The viewer's hand. Cards overlap like a held fan so they can render large
 * (readable down to 375px) without overflowing; the hovered card lifts above
 * its neighbours.
 */
export function Hand({
    cards,
    theme,
    onPlay,
    size = "lg",
    disabled = false,
}: HandProps) {
    return (
        <div className="flex items-end justify-center px-2 py-2">
            {cards.map((card) => (
                <div
                    key={cardKey(card)}
                    className={`${CARD_WIDTH_CLASS[size]} ${HAND_OVERLAP_CLASS[size]} relative transition-transform duration-150 hover:z-10 hover:-translate-y-2 focus-within:z-10`}
                >
                    <Card
                        card={card}
                        theme={theme}
                        onClick={
                            onPlay && !disabled ? () => onPlay(card) : undefined
                        }
                    />
                </div>
            ))}
        </div>
    );
}
