import { cardKey } from "@/lib/card/utils";
import { describeEcaEvent } from "@/lib/eca/display";
import type { EcaAction, EcaView } from "@/lib/eca/types";
import {
    faceDownPile,
    handFromActions,
    playerName,
    seatChips,
    turnBanner,
} from "../table/helpers";
import {
    registerTable,
    type TableControl,
    type TableZoneInstance,
} from "../table/types";

/** Every studio game shares the same zones and verbs, hence one table config. */

export const ecaTable = registerTable<EcaView, EcaAction>({
    zones: [
        {
            id: "draw",
            placement: "center",
            arrangement: "stack",
            cardSize: "md",
            framed: true,
        },
        {
            id: "discard",
            placement: "center",
            arrangement: "row",
            cardSize: "md",
            framed: true,
        },
        { id: "hand", placement: "bottom", arrangement: "fan", cardSize: "lg" },
    ],

    /** Rule effects are left to the server; a draw is never predicted (hidden card). */
    predict(view, a, viewerId) {
        if (viewerId === null || view.currentPlayerId !== viewerId) return null;
        const self = view.players.find((p) => p.id === viewerId);
        if (!self?.hand) return null;

        if (a.type === "pass") return { ...view, currentPlayerId: null };
        if (a.type !== "playCard") return null;

        const key = cardKey(a.card);
        if (!self.hand.some((c) => cardKey(c) === key)) return null;
        const nextHand = self.hand.filter((c) => cardKey(c) !== key);
        return {
            ...view,
            currentPlayerId: null,
            topDiscard: a.card,
            discardCount: view.discardCount + 1,
            players: view.players.map((p) =>
                p.id === viewerId
                    ? { ...p, hand: nextHand, handCount: nextHand.length }
                    : p,
            ),
        };
    },

    mapView(view, ctx) {
        const self = view.players.find((p) => p.id === ctx.viewerId);
        const isYourTurn = !ctx.isOver && view.currentPlayerId === ctx.viewerId;

        const seats = seatChips(
            view.players.map((p) => ({ ...p, playerId: p.id })),
            ctx,
            view.currentPlayerId,
            (p) => ctx.t("cards_left", { n: p.handCount }),
        );

        const legal = ctx.legalActions;
        const drawAction = legal.find((a) => a.type === "drawCard");
        const passAction = legal.find((a) => a.type === "pass");

        const zones: TableZoneInstance[] = [
            {
                key: "draw",
                zone: "draw",
                // The action sits on the zone: a reshuffle can refill an empty-looking pile.
                cards: faceDownPile("draw", Math.min(view.drawPileCount, 3)),
                caption: ctx.t("cards_left", { n: view.drawPileCount }),
                action: drawAction,
            },
            {
                key: "discard",
                zone: "discard",
                cards: view.topDiscard
                    ? [
                          {
                              // Depth-scoped id so each new top card animates in.
                              id: `discard:${cardKey(view.topDiscard)}:${view.discardCount}`,
                              card: view.topDiscard,
                          },
                      ]
                    : [],
                emptyHint: ctx.t("in_play"),
            },
        ];

        if (self?.hand) {
            zones.push({
                key: "hand",
                zone: "hand",
                cards: handFromActions(
                    self.hand,
                    legal.filter((a) => a.type === "playCard"),
                    isYourTurn,
                ),
            });
        }

        // The view carries no turn flags: legality alone decides these controls.
        const controls: TableControl[] = [];
        if (drawAction) {
            controls.push({
                key: "draw",
                label: ctx.t("draw"),
                action: drawAction,
                variant: "primary",
            });
        }
        if (passAction) {
            controls.push({
                key: "pass",
                label: ctx.t("pass"),
                action: passAction,
                variant: "danger",
            });
        }

        return {
            banner: turnBanner(ctx, view.currentPlayerId),
            seats,
            zones,
            controls,
            status: view.direction === -1 ? ctx.t("eca_reversed") : undefined,
        };
    },

    logLine(event, ctx) {
        return describeEcaEvent(event, ctx.t, (id) => playerName(ctx, id));
    },
});
