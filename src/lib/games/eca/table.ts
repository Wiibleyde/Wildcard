import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey, FACE_DOWN_CARD } from "@/lib/card/utils";
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
 * ECA (studio) table — ONE config renders every creator-authored game, because
 * every ECA game shares the same shape: a hand, a draw pile, a discard, and the
 * three verbs `playCard` / `drawCard` / `pass`. There is no per-game React and
 * no per-game config: the generic {@link GameModule} contract already reduced
 * each studio game to this common surface, so a single view→table projection
 * covers all of them.
 *
 * Interaction is direct-play (tap a legal card to lay it), matching the studio
 * sandbox: the board a creator tests in is the board everyone else plays on.
 */

const SUIT_GLYPH: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

/** "7♥" for a suited card; "?" for anything face-down/unknown (log lines). */
function cardLabel(value: unknown): string {
    if (typeof value !== "object" || value === null) return "?";
    const card = value as CardDescriptor;
    return card.type === "suited"
        ? `${card.rank}${SUIT_GLYPH[card.suit]}`
        : "?";
}

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

    /**
     * Optimistic prediction of the viewer's own play/pass: the card leaves the
     * hand and lands on the discard immediately, the turn blanked so the board
     * stops offering moves until the server reconciles. Rule effects (draw, skip,
     * reverse, play-again, end) are the server's to settle a beat later. `drawCard`
     * is never predicted — it reveals a face-down card the client can't know.
     */
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

        // The payload's legal actions came from this module — safe narrow.
        const legal = ctx.legalActions as readonly EcaAction[];
        const drawAction = legal.find((a) => a.type === "drawCard");
        const passAction = legal.find((a) => a.type === "pass");
        const playByKey = new Map<string, EcaAction>();
        for (const a of legal) {
            if (a.type === "playCard") playByKey.set(cardKey(a.card), a);
        }

        // Draw pile: a face-down stock (up to three slivers for depth). Clicking
        // the pile draws — the action lives on the zone so it works even once the
        // pile is visually empty but a reshuffle can still refill it.
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
                              // Scope the id by discard depth so each new top
                              // card gets a fresh identity and animates in.
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
                        // Your turn but this card has no legal play right now: a
                        // blocked move, not an inert card — a click says why.
                        illegal: isYourTurn && action === undefined,
                    };
                }),
            });
        }

        // Draw / Pass surface only when the game's rules make them legal this
        // turn — an ECA game may disable either entirely, and the view carries no
        // turn-config flags, so legality is the single source of truth.
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
        const p = event.payload ?? {};
        const name = playerName(
            ctx,
            typeof p.playerId === "string" ? p.playerId : null,
        );
        switch (event.type) {
            case "cardPlayed":
                return ctx.t("log_card_played", {
                    name,
                    card: cardLabel(p.card),
                });
            case "ruleFired":
                return ctx.t("log_rule_fired", {
                    rule: typeof p.ruleName === "string" ? p.ruleName : "?",
                });
            case "cardsDrawn":
                return ctx.t("log_cards_drawn", {
                    name,
                    count: typeof p.count === "number" ? p.count : 1,
                });
            case "directionReversed":
                return ctx.t("log_direction_reversed");
            case "playerSkipped":
                return ctx.t("log_player_skipped", { name });
            case "turnAdvanced":
                return ctx.t("log_turn_advanced", { name });
            case "gameEnded":
                return ctx.t("log_game_ended");
            default:
                return null;
        }
    },
});
