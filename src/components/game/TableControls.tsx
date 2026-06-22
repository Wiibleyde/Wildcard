"use client";

import { Card } from "@/components/card/Card";
import { GameButton, type GameButtonVariant } from "@/components/ui/GameButton";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import type { GameAction } from "@/lib/engine/types";
import type { TableControl } from "@/lib/games/table/types";

const BUTTON_VARIANT: Record<
    NonNullable<TableControl["variant"]>,
    GameButtonVariant
> = {
    primary: "gold",
    success: "green",
    danger: "red",
};

interface TableControlsProps {
    controls: readonly TableControl[];
    /** Skins the mini cards rendered inside combo buttons. */
    deckTheme: CardTheme;
    pending: boolean;
    onAction: (action: GameAction) => void;
}

/**
 * Action bar under the hand: plain verbs ("Passer") and card-combo
 * suggestions. Combo cards render on the shared `xs` card scale so
 * suggestions stay readable from mobile up to 2K screens.
 */
export function TableControls({
    controls,
    deckTheme,
    pending,
    onAction,
}: TableControlsProps) {
    if (controls.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 xl:gap-3">
            {controls.map((control) => (
                <GameButton
                    key={control.key}
                    size="sm"
                    variant={BUTTON_VARIANT[control.variant ?? "primary"]}
                    disabled={pending || control.disabled}
                    onClick={() => onAction(control.action)}
                    className="xl:text-sm"
                >
                    {control.cards?.map((card) => (
                        <div
                            key={cardKey(card)}
                            className={CARD_WIDTH_CLASS.xs}
                        >
                            <Card card={card} theme={deckTheme} />
                        </div>
                    ))}
                    {control.label}
                </GameButton>
            ))}
        </div>
    );
}
