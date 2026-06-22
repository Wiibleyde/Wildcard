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
    theme: CardTheme;
    onPlay?: (card: CardDescriptor) => void;
    size?: CardSize;
    disabled?: boolean;
}

export function Hand({
    cards,
    theme,
    onPlay,
    size = "lg",
    disabled = false,
}: HandProps) {
    return (
        <div className="flex w-full max-w-full items-end overflow-x-auto">
            <div className="mx-auto flex items-end px-2 pb-2 pt-3">
                {cards.map((card) => (
                    <div
                        key={cardKey(card)}
                        className={`${CARD_WIDTH_CLASS[size]} ${HAND_OVERLAP_CLASS[size]} relative shrink-0 transition-transform duration-150 hover:z-10 hover:-translate-y-2 focus-within:z-10`}
                    >
                        <Card
                            card={card}
                            theme={theme}
                            onClick={
                                onPlay && !disabled
                                    ? () => onPlay(card)
                                    : undefined
                            }
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
