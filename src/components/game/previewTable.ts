import type { CardDescriptor } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import { registerTable } from "@/lib/games/table/types";

// Customisation preview: a static two-seat table rendered by the real GameTable.

export const PREVIEW_SELF = "preview-self";
export const PREVIEW_OPPONENT = "preview-opponent";

export interface PreviewCard {
    readonly id: string;
    readonly card: CardDescriptor;
    readonly ownerId: string;
}

export interface PreviewView {
    readonly hand: readonly PreviewCard[];
    readonly trick: readonly PreviewCard[];
    readonly opponentHand: number;
    readonly hint: string;
}

export interface PreviewPlay extends GameAction {
    readonly cardId: string;
}

export function isPreviewPlay(action: GameAction): action is PreviewPlay {
    return typeof (action as Partial<PreviewPlay>).cardId === "string";
}

export const previewTable = registerTable<PreviewView>({
    zones: [
        { id: "trick", placement: "center", arrangement: "row", framed: true },
        { id: "hand", placement: "bottom", arrangement: "fan", cardSize: "lg" },
    ],
    mapView(view, ctx) {
        const opponent = ctx.players.find((p) => p.userId === PREVIEW_OPPONENT);
        return {
            banner: { label: view.hint, highlight: true },
            seats: [
                {
                    playerId: PREVIEW_OPPONENT,
                    name: opponent?.username ?? "",
                    handCount: view.opponentHand,
                    isTurn: false,
                },
            ],
            zones: [
                { key: "trick", zone: "trick", cards: view.trick },
                {
                    key: "hand",
                    zone: "hand",
                    cards: view.hand.map((c) => ({
                        ...c,
                        action: {
                            type: "preview_play",
                            playerId: PREVIEW_SELF,
                            cardId: c.id,
                        } satisfies PreviewPlay,
                    })),
                },
            ],
        };
    },
});
