import { cardKey } from "@/lib/card/utils";
import { playerName } from "../table/helpers";
import { registerTable, type TableZoneInstance } from "../table/types";
import type { BatailleView } from "./bataille";

/**
 * Bataille table — one `reveal` zone instance per player in the center
 * (their flipped cards, skinned with their own deck style), a single Flip
 * control, and a round-result status line. No hand: the engine resolves a
 * whole round per flip.
 */
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
        const self = view.players.find((p) => p.playerId === ctx.viewerId);
        const flip = ctx.legalActions.find((a) => a.type === "flip");

        const banner = ctx.isOver
            ? ctx.t("game_over")
            : self
              ? ctx.t("your_turn")
              : ctx.t("spectating");

        const zones: TableZoneInstance[] = view.players.map((p) => ({
            key: `reveal:${p.playerId}`,
            zone: "reveal",
            // Ids are scoped by turn: piles recycle (won cards reshuffle into
            // the draw), so the same physical card reappears in later rounds
            // and must get a fresh identity to animate again.
            cards: p.lastReveal.map((card) => ({
                id: `reveal:${p.playerId}:${view.turn}:${cardKey(card)}`,
                card,
                ownerId: p.playerId,
            })),
            caption: `${p.name} — ${ctx.t("cards_left", { n: p.total })}`,
        }));

        const lastWinnerName = view.players.find(
            (p) => p.playerId === view.lastWinner,
        )?.name;

        return {
            banner: {
                label: banner,
                highlight: !ctx.isOver && flip !== undefined,
            },
            zones,
            status: view.lastWinner
                ? ctx.t("last_winner", { name: lastWinnerName ?? "?" })
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
            // One log line per resolved round; the triggering "flip" itself
            // is noise (every round starts with one).
            case "round_resolved": {
                const round = typeof p.round === "number" ? p.round : 0;
                return p.winner
                    ? ctx.t("log_round_won", {
                          name: playerName(ctx, p.winner),
                          n: round,
                      })
                    : ctx.t("log_round_draw", { n: round });
            }
            case "game_over":
                return ctx.t("game_over");
            default:
                return null;
        }
    },
});
