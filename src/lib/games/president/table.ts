import { cardKey } from "@/lib/card/utils";
import {
    registerTable,
    type TableContext,
    type TableControl,
    type TableZoneInstance,
} from "../table/types";
import type {
    PresidentAction,
    PresidentPlayerView,
    PresidentView,
} from "./president";

function nameOf(ctx: TableContext, playerId: string | null): string {
    if (!playerId) return "?";
    return ctx.players.find((p) => p.userId === playerId)?.username ?? "?";
}

/** "Président" / "Vice-Président" / "Vice-Trou" / "Trou du cul" / "Terminé
 * (n)" — or `null` while playing. Vice titles need a 4th seat to exist. */
function placeLabel(
    ctx: TableContext,
    view: PresidentView,
    p: PresidentPlayerView,
): string | null {
    if (p.demoted) return ctx.t("place_asshole");
    if (p.place === null) return null;
    const n = view.players.length;
    if (p.place === 1) return ctx.t("place_president");
    if (p.place === n) return ctx.t("place_asshole");
    if (n >= 4 && p.place === 2) return ctx.t("place_vice_president");
    if (n >= 4 && p.place === n - 1) return ctx.t("place_vice_asshole");
    return ctx.t("finished", { place: p.place });
}

/**
 * Président table — opponent seats on top, the framed trick zone in the
 * center (every play of the uncleared trick, each card skinned with its
 * player's deck style), the viewer's fan at the bottom, and legal combos +
 * pass as controls.
 */
export const presidentTable = registerTable<PresidentView>({
    zones: [
        {
            id: "trick",
            placement: "center",
            arrangement: "row",
            cardSize: "md",
            framed: true,
        },
        { id: "hand", placement: "bottom", arrangement: "fan", cardSize: "lg" },
    ],

    mapView(view, ctx) {
        const self = view.players.find((p) => p.playerId === ctx.viewerId);
        const isYourTurn = !ctx.isOver && view.currentPlayerId === ctx.viewerId;

        const banner = ctx.isOver
            ? ctx.t("game_over")
            : isYourTurn
              ? ctx.t("your_turn")
              : self
                ? ctx.t("waiting_for", {
                      name: nameOf(ctx, view.currentPlayerId),
                  })
                : ctx.t("spectating");

        const seats = view.players
            .filter((p) => p.playerId !== ctx.viewerId)
            .map((p) => {
                const place = placeLabel(ctx, view, p);
                return {
                    playerId: p.playerId,
                    name: p.name,
                    handCount: p.handCount,
                    isTurn: !ctx.isOver && p.playerId === view.currentPlayerId,
                    status:
                        place ??
                        (p.passed
                            ? ctx.t("passed")
                            : ctx.t("cards_left", { n: p.handCount })),
                };
            });

        // The whole uncleared trick stays on the table — every play visible,
        // each card skinned with the deck style of the player who laid it.
        const topPlay = view.pile.at(-1);
        const zones: TableZoneInstance[] = [
            {
                key: "trick",
                zone: "trick",
                cards: view.pile.flatMap((play) =>
                    play.cards.map((card) => ({
                        id: `trick:${cardKey(card)}`,
                        card,
                        ownerId: play.playerId,
                    })),
                ),
                caption: topPlay ? nameOf(ctx, topPlay.playerId) : undefined,
                emptyHint: ctx.t("in_play"),
            },
        ];

        if (self?.hand) {
            zones.push({
                key: "hand",
                zone: "hand",
                cards: self.hand.map((card) => ({
                    id: `hand:${cardKey(card)}`,
                    card,
                })),
                badge: placeLabel(ctx, view, self) ?? undefined,
            });
        }

        // The payload's legal actions came from this module — safe narrow.
        const legal = ctx.legalActions as readonly PresidentAction[];
        const controls: TableControl[] = [];
        if (isYourTurn) {
            for (const action of legal) {
                if (action.type !== "play") continue;
                controls.push({
                    key: `play:${action.cards.map(cardKey).join("+")}`,
                    cards: action.cards,
                    action,
                    variant: "success",
                });
            }
            const pass = legal.find((a) => a.type === "pass");
            if (pass) {
                controls.push({
                    key: "pass",
                    label: ctx.t("pass"),
                    action: pass,
                    variant: "danger",
                });
            }
        }

        return {
            banner: { label: banner, highlight: isYourTurn },
            seats,
            zones,
            controls,
            status: view.revolution ? ctx.t("revolution") : undefined,
        };
    },
});
