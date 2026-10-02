import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import type { GameAction } from "@/lib/engine/types";
import { playerName } from "../table/helpers";
import {
    registerTable,
    type TableCardItem,
    type TableContext,
    type TableControl,
    type TableSeat,
    type TableZoneInstance,
} from "../table/types";
import type { Bid, HandfulLevel } from "./scoring";
import {
    SUIT_STRENGTH,
    type TarotAction,
    type TarotPlayerView,
    type TarotView,
} from "./tarot";

/** Hand reading order: suits grouped low→high, then trumps, then the Excuse. */
const SUIT_GROUP: Record<Suit, number> = {
    spades: 0,
    hearts: 1,
    diamonds: 2,
    clubs: 3,
};
function handOrder(card: CardDescriptor): number {
    if (card.type === "suited") {
        return SUIT_GROUP[card.suit] * 100 + SUIT_STRENGTH[card.rank];
    }
    if (card.type === "trump") return 400 + card.index;
    return 500; // the Excuse sits at the end
}

const SUIT_SYMBOL: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

function bidLabel(ctx: TableContext, bid: Bid): string {
    return ctx.t(`tarot_bid_${bid.replace(/-/g, "_")}`);
}

/** Human, localized name of a card for the log feed. */
function cardLabel(ctx: TableContext, card: CardDescriptor): string {
    if (card.type === "fool") return ctx.t("tarot_excuse");
    if (card.type === "trump") {
        return ctx.t("tarot_trump", { index: card.index });
    }
    if (card.type === "suited") {
        const rank =
            card.rank === "J" ||
            card.rank === "C" ||
            card.rank === "Q" ||
            card.rank === "K" ||
            card.rank === "A"
                ? ctx.t(`rank_${card.rank}`)
                : card.rank;
        return `${rank} ${SUIT_SYMBOL[card.suit]}`;
    }
    return "?";
}

function handfulLabel(ctx: TableContext, level: HandfulLevel): string {
    return ctx.t(`tarot_handful_${level}`);
}

/** Short status line under an opponent's seat chip. */
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

/**
 * Tarot table — opponents on top, a framed center holding the revealed chien
 * (bidding-then-dog) or the running trick (jeu de la carte), the viewer's fan
 * below. The phase drives the controls: bid buttons while bidding, then the
 * hand becomes a one-tap card picker (bury for the écart, then play to the
 * trick). Every card is skinned with its player's own deck style.
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
        // Poignées shown during the first trick — public, one per declarer.
        // Top band, not center: on a height-bounded board every center row is
        // sized to the region's height, so a second one would overflow. Who
        // showed it reads on their seat chip and in the log, so no caption.
        {
            id: "handful",
            placement: "top",
            arrangement: "row",
            cardSize: "xs",
        },
        { id: "hand", placement: "bottom", arrangement: "fan", cardSize: "lg" },
    ],

    /**
     * Optimistic prediction of the viewer's own play: the card leaves the hand
     * and lands on the trick at once, no round-trip. The turn is blanked so
     * `mapView` stops treating it as ours until the server reconciles; trick
     * closes (winner, sweep) are the server's to settle a beat later. Bids and
     * discards aren't predicted — they reconcile on the near-instant refetch.
     */
    predict(view, action, viewerId) {
        if (viewerId === null) return null;
        const a = action as TarotAction;
        if (a.type !== "play") return null;
        const self = view.players.find((p) => p.playerId === viewerId);
        if (!self?.hand || view.currentPlayerId !== viewerId) return null;
        const key = cardKey(a.card);
        if (!self.hand.some((c) => cardKey(c) === key)) return null;

        const leadingNow = view.pile.length === 0;
        const nextHand = self.hand.filter((c) => cardKey(c) !== key);
        return {
            ...view,
            currentPlayerId: "",
            pile: [
                ...(leadingNow ? [] : view.pile),
                { playerId: viewerId, card: a.card },
            ],
            lastTrick: leadingNow ? null : view.lastTrick,
            players: view.players.map((p) =>
                p.playerId === viewerId
                    ? { ...p, hand: nextHand, handCount: nextHand.length }
                    : p,
            ),
        };
    },

    mapView(view, ctx) {
        const self = view.players.find((p) => p.playerId === ctx.viewerId);
        const isYourTurn = !ctx.isOver && view.currentPlayerId === ctx.viewerId;

        const bannerKey =
            view.phase === "bidding"
                ? "tarot_your_bid"
                : view.phase === "dog"
                  ? "tarot_your_ecart"
                  : view.phase === "slam"
                    ? "tarot_your_slam"
                    : "your_turn";
        const banner = ctx.isOver
            ? ctx.t("game_over")
            : isYourTurn
              ? ctx.t(bannerKey)
              : self
                ? ctx.t("waiting_for", {
                      name: playerName(ctx, view.currentPlayerId),
                  })
                : ctx.t("spectating");

        const seats: TableSeat[] = view.players
            .filter((p) => p.playerId !== ctx.viewerId)
            .map((p) => ({
                playerId: p.playerId,
                name: p.name,
                handCount: p.handCount,
                isTurn: !ctx.isOver && p.playerId === view.currentPlayerId,
                status: seatStatus(ctx, view, p),
            }));

        const zones: TableZoneInstance[] = [];

        // The chien, face up, while it is revealed (dog phase and at game end).
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

        // The running trick (or the just-won one, kept until the next lead).
        if (view.phase === "playing" || view.phase === "done") {
            const showingLast = view.pile.length === 0 && view.lastTrick;
            const plays = showingLast ? view.lastTrick.plays : view.pile;
            const top = plays.at(-1);
            // The empty « en jeu » placeholder has a fixed card size; next to a
            // handful row it would overflow a height-bounded board, so it
            // waits for the first card (real cards size to the region).
            if (plays.length > 0 || !showingHandful)
                zones.push({
                    key: "trick",
                    zone: "trick",
                    cards: plays.map((play) => ({
                        id: `trick:${cardKey(play.card)}`,
                        card: play.card,
                        ownerId: play.playerId,
                    })),
                    caption: showingLast
                        ? ctx.t("trick_won", {
                              name: playerName(ctx, view.lastTrick.winnerId),
                          })
                        : top
                          ? playerName(ctx, top.playerId)
                          : undefined,
                    emptyHint: ctx.t("in_play"),
                });
        }

        // The hand becomes a one-tap picker: each legal card carries its play /
        // discard action; on your turn, a card with no legal action is flagged
        // illegal so a tap explains why instead of doing nothing.
        const legal = ctx.legalActions as readonly TarotAction[];
        const actionFor = new Map<string, GameAction>();
        for (const a of legal) {
            if (a.type === "play" || a.type === "discard") {
                actionFor.set(cardKey(a.card), a);
            }
        }
        const cardPhase = view.phase === "dog" || view.phase === "playing";

        if (self?.hand) {
            const hand = [...self.hand].sort(
                (a, b) => handOrder(a) - handOrder(b),
            );
            zones.push({
                key: "hand",
                zone: "hand",
                cards: hand.map((card): TableCardItem => {
                    const action = actionFor.get(cardKey(card));
                    return {
                        id: `hand:${cardKey(card)}`,
                        card,
                        action,
                        illegal: isYourTurn && cardPhase && !action,
                    };
                }),
                badge:
                    view.phase === "dog" && self.isTaker
                        ? ctx.t("tarot_ecart_progress", { n: view.ecartCount })
                        : undefined,
            });
        }

        // Bidding controls: one button per legal overcall, plus pass.
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

        // Slam decision (FFT « chelem annoncé »): the taker, before any card.
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

        // Poignée: offered alongside the hand, just before your first card.
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
            banner: { label: banner, highlight: isYourTurn },
            seats,
            zones,
            controls,
            status: statusLine(ctx, view),
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        const name = playerName(
            ctx,
            typeof p.playerId === "string" ? p.playerId : null,
        );
        switch (event.type) {
            case "bid":
                return ctx.t("tarot_log_bid", {
                    name,
                    bid: bidLabel(ctx, p.bid as Bid),
                });
            case "passed":
                return ctx.t("log_passed", { name });
            case "passed_out":
                return ctx.t("tarot_log_passed_out");
            case "contract":
                return ctx.t("tarot_log_contract", {
                    name,
                    contract: bidLabel(ctx, p.contract as Bid),
                });
            case "chien_revealed":
                return ctx.t("tarot_log_chien");
            case "slam_announced":
                return ctx.t("tarot_log_slam", { name });
            case "handful":
                return ctx.t("tarot_log_handful", {
                    name,
                    level: handfulLabel(ctx, p.level as HandfulLevel),
                });
            case "ecart_done":
                return ctx.t("tarot_log_ecart");
            case "played":
                return ctx.t("tarot_log_played", {
                    name,
                    card: cardLabel(ctx, p.card as CardDescriptor),
                });
            case "trick_won":
                return ctx.t("tarot_log_trick", { name });
            case "game_over":
                return ctx.t("tarot_log_over", {
                    name: playerName(
                        ctx,
                        typeof p.taker === "string" ? p.taker : null,
                    ),
                    result: ctx.t(
                        p.made === true ? "tarot_made" : "tarot_failed",
                    ),
                });
            default:
                return null; // per-discard noise stays out of the feed
        }
    },
});

/** Accent status line under the center zone — phase-specific context. */
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
