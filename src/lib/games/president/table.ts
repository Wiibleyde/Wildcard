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

/** Court cards get their localized name ("Dame"), pips stay as digits. */
function rankLabel(ctx: TableContext, rank: unknown): string {
    const r = String(rank);
    return r === "J" || r === "Q" || r === "K" || r === "A"
        ? ctx.t(`rank_${r}`)
        : r;
}

/** Title for a clean finish, when one exists ("Président", "Vice-Trou"…). */
function finishTitle(ctx: TableContext, place: number): string | null {
    const n = ctx.players.length;
    if (place === 1) return ctx.t("place_president");
    if (place === n) return ctx.t("place_asshole");
    if (n >= 4 && place === 2) return ctx.t("place_vice_president");
    if (n >= 4 && place === n - 1) return ctx.t("place_vice_asshole");
    return null;
}

/** "Président" / "Vice-Président" / "Vice-Trou" / "Trou du cul" / "Terminé
 * (n)" — or `null` while playing. Vice titles need a 4th seat to exist. */
function placeLabel(ctx: TableContext, p: PresidentPlayerView): string | null {
    if (p.demoted) return ctx.t("place_asshole");
    if (p.place === null) return null;
    return finishTitle(ctx, p.place) ?? ctx.t("finished", { place: p.place });
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
                const place = placeLabel(ctx, p);
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
                badge: placeLabel(ctx, self) ?? undefined,
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
            status: view.revolution
                ? ctx.t("revolution")
                : view.equalLock && view.combo
                  ? ctx.t("or_nothing_status", {
                        rank: rankLabel(ctx, view.combo.rank),
                    })
                  : undefined,
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        const name = nameOf(
            ctx,
            typeof p.playerId === "string" ? p.playerId : null,
        );
        switch (event.type) {
            case "played": {
                const rank = rankLabel(ctx, p.rank);
                const count = typeof p.count === "number" ? p.count : 1;
                return count > 1
                    ? ctx.t("log_played_many", { name, rank, count })
                    : ctx.t("log_played_one", { name, rank });
            }
            case "passed":
                return ctx.t("log_passed", { name });
            case "or_nothing":
                return ctx.t("log_or_nothing", {
                    name,
                    rank: rankLabel(ctx, p.rank),
                });
            case "finished": {
                const place = typeof p.place === "number" ? p.place : 0;
                const title = finishTitle(ctx, place);
                return title
                    ? ctx.t("log_finished_title", { name, title })
                    : ctx.t("log_finished", { name, place });
            }
            case "demoted":
                return ctx.t("log_demoted", { name });
            case "revolution":
                return p.active === true
                    ? ctx.t("log_revolution")
                    : ctx.t("log_counter_revolution");
            case "trick_cleared":
                return ctx.t("log_trick_cleared", {
                    name: nameOf(
                        ctx,
                        typeof p.leadPlayerId === "string"
                            ? p.leadPlayerId
                            : null,
                    ),
                });
            case "game_over":
                return ctx.t("game_over");
            default:
                return null;
        }
    },
});
