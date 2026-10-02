import { cardKey, FACE_DOWN_CARD } from "@/lib/card/utils";
import { describeEcaEvent } from "@/lib/eca/display";
import type { EcaAction, EcaView } from "@/lib/eca/types";
import { playerName } from "../table/helpers";
import {
    registerTable,
    type TableCardItem,
    type TableControl,
    type TableSeat,
    type TableZoneInstance,
} from "../table/types";

/**
 * One table config for every studio game: they all share a hand, a draw pile,
 * a discard and the verbs playCard / drawCard / pass. (The Studio sandbox has
 * its own lighter UI; only the event log text is shared, via `describeEcaEvent`.)
 */

export const ecaTable = registerTable<EcaView>({
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
    predict(view, action, viewerId) {
        if (viewerId === null || view.currentPlayerId !== viewerId) return null;
        const a = action as EcaAction;
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

        const banner = ctx.isOver
            ? ctx.t("game_over")
            : isYourTurn
              ? ctx.t("your_turn")
              : self
                ? ctx.t("waiting_for", {
                      name: playerName(ctx, view.currentPlayerId),
                  })
                : ctx.t("spectating");

        const seats: TableSeat[] = view.players
            .filter((p) => p.id !== ctx.viewerId)
            .map((p) => ({
                playerId: p.id,
                name: p.name,
                handCount: p.handCount,
                isTurn: !ctx.isOver && p.id === view.currentPlayerId,
                status: ctx.t("cards_left", { n: p.handCount }),
            }));

        // Legal actions come from this module.
        const legal = ctx.legalActions as readonly EcaAction[];
        const drawAction = legal.find((a) => a.type === "drawCard");
        const passAction = legal.find((a) => a.type === "pass");
        const playByKey = new Map<string, EcaAction>();
        for (const a of legal) {
            if (a.type === "playCard") playByKey.set(cardKey(a.card), a);
        }

        // The draw action lives on the zone: it still works once the pile looks
        // empty but a reshuffle can refill it.
        const drawSlots = Math.min(view.drawPileCount, 3);
        const drawCards: TableCardItem[] = Array.from(
            { length: drawSlots },
            (_, i) => ({
                id: `draw:${i}`,
                card: FACE_DOWN_CARD,
                faceDown: true,
            }),
        );

        const zones: TableZoneInstance[] = [
            {
                key: "draw",
                zone: "draw",
                cards: drawCards,
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
                cards: self.hand.map((card) => {
                    const action = playByKey.get(cardKey(card));
                    return {
                        id: `hand:${cardKey(card)}`,
                        card,
                        action,
                        // Clickable so the board can say why it is blocked.
                        illegal: isYourTurn && action === undefined,
                    };
                }),
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
            banner: { label: banner, highlight: isYourTurn },
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
