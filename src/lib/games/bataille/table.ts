import { cardKey } from "@/lib/card/utils";
import { playerName, turnBanner } from "../table/helpers";
import { registerTable, type TableZoneInstance } from "../table/types";
import type { BatailleView } from "./bataille";

/** One reveal row per player, a Flip control, a round-result status line. No hand. */
export const batailleTable = registerTable<BatailleView>({
    zones: [
        {
            id: "reveal",
            placement: "center",
            arrangement: "row",
            cardSize: "md",
        },
    ],

    mapView(view, ctx) {
        const flip = ctx.legalActions.find((a) => a.type === "flip");

        const zones: TableZoneInstance[] = view.players.map((p) => ({
            key: `reveal:${p.playerId}`,
            zone: "reveal",
            // Scoped by turn: won piles recycle, so a physical card reappears
            // in later rounds and needs a fresh identity to animate again.
            cards: p.lastReveal.map((card) => ({
                id: `reveal:${p.playerId}:${view.turn}:${cardKey(card)}`,
                card,
                ownerId: p.playerId,
            })),
            caption: `${playerName(ctx, p.playerId)} — ${ctx.t("cards_left", { n: p.total })}`,
        }));

        return {
            // Simultaneous game: every seated player may flip.
            banner: turnBanner(ctx, ctx.viewerId),
            zones,
            status: view.lastWinner
                ? ctx.t("last_winner", {
                      name: playerName(ctx, view.lastWinner),
                  })
                : view.turn > 0
                  ? ctx.t("draw_round")
                  : undefined,
            controls:
                !ctx.isOver && flip
                    ? [
                          {
                              key: "flip",
                              label: ctx.t("flip"),
                              action: flip,
                              variant: "primary",
                          },
                      ]
                    : [],
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        switch (event.type) {
            case "round_resolved": {
                const round = typeof p.round === "number" ? p.round : 0;
                return p.winner
                    ? ctx.t("log_round_won", {
                          name: playerName(ctx, p.winner),
                          n: round,
                      })
                    : ctx.t("log_round_draw", { n: round });
            }
            case "round_limit":
                return ctx.t("log_round_limit", {
                    n: typeof p.rounds === "number" ? p.rounds : 0,
                });
            case "game_over":
                return ctx.t("game_over");
            default:
                return null;
        }
    },
});
