import type { CardDescriptor } from "@/lib/card/types";
import {
    cardKey,
    isCardDescriptor,
    rankLabel,
    SUIT_DISPLAY_ORDER,
    SUIT_SYMBOL,
} from "@/lib/card/utils";
import {
    handFromActions,
    playerName,
    seatChips,
    turnBanner,
} from "../table/helpers";
import {
    registerTable,
    type TableContext,
    type TableControl,
    type TableZoneInstance,
} from "../table/types";
import {
    BID_RANK,
    type Bid,
    HANDFUL_LEVELS,
    type HandfulLevel,
} from "./scoring";
import {
    SUIT_STRENGTH,
    type TarotAction,
    type TarotPlayerView,
    type TarotView,
} from "./tarot";

/** Suits grouped low → high, then trumps, then the Excuse. */
function handOrder(card: CardDescriptor): number {
    if (card.type === "suited") {
        return SUIT_DISPLAY_ORDER[card.suit] * 100 + SUIT_STRENGTH[card.rank];
    }
    if (card.type === "trump") return 400 + card.index;
    return 500;
}

function isBid(value: unknown): value is Bid {
    return typeof value === "string" && Object.hasOwn(BID_RANK, value);
}

function isHandfulLevel(value: unknown): value is HandfulLevel {
    return HANDFUL_LEVELS.some((level) => level === value);
}

function bidLabel(ctx: TableContext, bid: unknown): string {
    return isBid(bid) ? ctx.t(`tarot_bid_${bid.replace(/-/g, "_")}`) : "?";
}

function cardLabel(ctx: TableContext, card: unknown): string {
    if (!isCardDescriptor(card)) return "?";
    if (card.type === "fool") return ctx.t("tarot_excuse");
    if (card.type === "trump") {
        return ctx.t("tarot_trump", { index: card.index });
    }
    if (card.type === "suited") {
        return `${rankLabel(ctx.t, card.rank)} ${SUIT_SYMBOL[card.suit]}`;
    }
    return "?";
}

function handfulLabel(ctx: TableContext, level: unknown): string {
    return isHandfulLevel(level) ? ctx.t(`tarot_handful_${level}`) : "?";
}

function seatStatus(
    ctx: TableContext,
    view: TarotView,
    p: TarotPlayerView,
): string {
    const base = seatBaseStatus(ctx, view, p);
    return p.handful ? `${base} · ${handfulLabel(ctx, p.handful.level)}` : base;
}

function seatBaseStatus(
    ctx: TableContext,
    view: TarotView,
    p: TarotPlayerView,
): string {
    if (p.isTaker) {
        return view.contract
            ? `${ctx.t("tarot_taker")} · ${bidLabel(ctx, view.contract)}`
            : ctx.t("tarot_taker");
    }
    if (view.phase === "bidding") {
        return p.bid
            ? p.bid === "pass"
                ? ctx.t("passed")
                : bidLabel(ctx, p.bid)
            : "…";
    }
    return ctx.t("cards_left", { n: p.handCount });
}

const YOUR_TURN_KEY: Record<TarotView["phase"], string> = {
    bidding: "tarot_your_bid",
    dog: "tarot_your_ecart",
    slam: "tarot_your_slam",
    playing: "your_turn",
    done: "your_turn",
};

/**
 * The center holds the revealed chien or the running trick; the hand is a
 * one-tap picker (bury for the écart, then play). Bids, the slam decision
 * and poignées are controls.
 */
export const tarotTable = registerTable<TarotView>({
    zones: [
        {
            id: "chien",
            placement: "center",
            arrangement: "row",
            cardSize: "md",
            framed: true,
        },
        {
            id: "trick",
            placement: "center",
            arrangement: "row",
            cardSize: "md",
            framed: true,
        },
        // Top band, not center: on a height-bounded board a second center row
        // would overflow. The seat chip and log say who showed it.
        {
            id: "handful",
            placement: "top",
            arrangement: "row",
            cardSize: "xs",
        },
        { id: "hand", placement: "bottom", arrangement: "fan", cardSize: "lg" },
    ],

    /** Card plays only: the card leaves the hand and lands on the trick; closes are the server's. */
    predict(view, action, viewerId) {
        if (viewerId === null) return null;
        const a = action as TarotAction;
        if (a.type !== "play") return null;
        const self = view.players.find((p) => p.playerId === viewerId);
        if (!self?.hand || view.currentPlayerId !== viewerId) return null;
        const key = cardKey(a.card);
        // The hand's own copy, mirroring the server — never the action's.
        const card = self.hand.find((c) => cardKey(c) === key);
        if (!card) return null;

        const nextHand = self.hand.filter((c) => cardKey(c) !== key);
        const pile = [...view.pile, { playerId: viewerId, card }];
        return {
            ...view,
            currentPlayerId: null,
            pile,
            displayTrick: { plays: pile, wonBy: null },
            players: view.players.map((p) =>
                p.playerId === viewerId
                    ? { ...p, hand: nextHand, handCount: nextHand.length }
                    : p,
            ),
        };
    },

    mapView(view, ctx) {
        const self = view.players.find((p) => p.playerId === ctx.viewerId);
        const banner = turnBanner(
            ctx,
            view.currentPlayerId,
            YOUR_TURN_KEY[view.phase],
        );
        const isYourTurn = banner.highlight;

        const seats = seatChips(view.players, ctx, view.currentPlayerId, (p) =>
            seatStatus(ctx, view, p),
        );

        const zones: TableZoneInstance[] = [];

        if (view.chienRevealed && view.chien.length > 0) {
            zones.push({
                key: "chien",
                zone: "chien",
                cards: view.chien.map((card) => ({
                    id: `chien:${cardKey(card)}`,
                    card,
                })),
                caption: ctx.t("tarot_the_chien"),
            });
        }

        // Poignées stay on display until the first trick is won.
        const firstTrick = view.players.every((p) => p.trickWins === 0);
        const showingHandful =
            view.phase === "playing" &&
            firstTrick &&
            view.players.some((p) => p.handful);
        if (showingHandful) {
            for (const p of view.players) {
                if (!p.handful) continue;
                zones.push({
                    key: `handful:${p.playerId}`,
                    zone: "handful",
                    cards: p.handful.cards.map((card) => ({
                        id: `handful:${p.playerId}:${cardKey(card)}`,
                        card,
                        ownerId: p.playerId,
                    })),
                });
            }
        }

        if (view.phase === "playing" || view.phase === "done") {
            const { plays, wonBy } = view.displayTrick;
            const top = plays.at(-1);
            // The empty placeholder has a fixed size: next to a handful row
            // it would overflow, so it waits for the first card.
            if (plays.length > 0 || !showingHandful)
                zones.push({
                    key: "trick",
                    zone: "trick",
                    cards: plays.map((play) => ({
                        id: `trick:${cardKey(play.card)}`,
                        card: play.card,
                        ownerId: play.playerId,
                    })),
                    caption: wonBy
                        ? ctx.t("trick_won", { name: playerName(ctx, wonBy) })
                        : top
                          ? playerName(ctx, top.playerId)
                          : undefined,
                    emptyHint: ctx.t("in_play"),
                });
        }

        // Legal actions come from this module — safe narrow.
        const legal = ctx.legalActions as readonly TarotAction[];
        const cardPhase = view.phase === "dog" || view.phase === "playing";

        if (self?.hand) {
            const hand = [...self.hand].sort(
                (a, b) => handOrder(a) - handOrder(b),
            );
            zones.push({
                key: "hand",
                zone: "hand",
                cards: handFromActions(
                    hand,
                    legal.filter(
                        (a) => a.type === "play" || a.type === "discard",
                    ),
                    isYourTurn && cardPhase,
                ),
                badge:
                    view.phase === "dog" && self.isTaker
                        ? ctx.t("tarot_ecart_progress", { n: view.ecartCount })
                        : undefined,
            });
        }

        const controls: TableControl[] = [];
        if (view.phase === "bidding" && isYourTurn) {
            for (const a of legal) {
                if (a.type === "bid") {
                    controls.push({
                        key: `bid:${a.bid}`,
                        label: bidLabel(ctx, a.bid),
                        action: a,
                        variant: "primary",
                    });
                }
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

        if (view.phase === "slam" && isYourTurn) {
            const announce = legal.find((a) => a.type === "announceSlam");
            const pass = legal.find((a) => a.type === "pass");
            if (announce) {
                controls.push({
                    key: "slam",
                    label: ctx.t("tarot_announce_slam"),
                    action: announce,
                    variant: "primary",
                });
            }
            if (pass) {
                controls.push({
                    key: "no-slam",
                    label: ctx.t("tarot_no_slam"),
                    action: pass,
                    variant: "danger",
                });
            }
        }

        const handful = legal.find((a) => a.type === "handful");
        if (view.phase === "playing" && isYourTurn && handful) {
            controls.push({
                key: "handful",
                label: ctx.t("tarot_show_handful", {
                    level: handfulLabel(ctx, handful.level),
                }),
                action: handful,
                variant: "primary",
            });
        }

        return {
            banner,
            seats,
            zones,
            controls,
            status: statusLine(ctx, view),
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        const name = playerName(ctx, p.playerId);
        switch (event.type) {
            case "bid":
                return ctx.t("tarot_log_bid", {
                    name,
                    bid: bidLabel(ctx, p.bid),
                });
            case "passed":
                return ctx.t("log_passed", { name });
            case "passed_out":
                return ctx.t("tarot_log_passed_out");
            case "contract":
                return ctx.t("tarot_log_contract", {
                    name,
                    contract: bidLabel(ctx, p.contract),
                });
            case "chien_revealed":
                return ctx.t("tarot_log_chien");
            case "slam_announced":
                return ctx.t("tarot_log_slam", { name });
            case "handful":
                return ctx.t("tarot_log_handful", {
                    name,
                    level: handfulLabel(ctx, p.level),
                });
            case "ecart_done":
                return ctx.t("tarot_log_ecart");
            case "played":
                return ctx.t("tarot_log_played", {
                    name,
                    card: cardLabel(ctx, p.card),
                });
            case "trick_won":
                return ctx.t("tarot_log_trick", { name });
            case "game_over":
                return ctx.t("tarot_log_over", {
                    name: playerName(ctx, p.taker),
                    result: ctx.t(
                        p.made === true ? "tarot_made" : "tarot_failed",
                    ),
                });
            default:
                return null;
        }
    },
});

function statusLine(ctx: TableContext, view: TarotView): string | undefined {
    if (view.phase === "bidding") {
        return view.highestBid
            ? ctx.t("tarot_bidding_status", {
                  bid: bidLabel(ctx, view.highestBid),
              })
            : ctx.t("tarot_bidding_none");
    }
    if (view.phase === "dog") {
        return ctx.t("tarot_ecart_progress", { n: view.ecartCount });
    }
    if (view.phase === "done" && view.result) {
        const pts = Math.abs(view.result.perDefender);
        return ctx.t(
            view.result.made ? "tarot_result_made" : "tarot_result_failed",
            { points: pts },
        );
    }
    if (view.contract && view.taker) {
        const status = ctx.t("tarot_contract_status", {
            contract: bidLabel(ctx, view.contract),
            name: playerName(ctx, view.taker),
        });
        return view.slamAnnounced
            ? `${status} · ${ctx.t("tarot_slam_status")}`
            : status;
    }
    return undefined;
}
