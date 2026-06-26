import type { CardDescriptor } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { playerName } from "../table/helpers";
import {
    registerTable,
    type TableContext,
    type TableControl,
    type TableHandPlay,
    type TableZoneInstance,
} from "../table/types";
import {
    type PresidentAction,
    type PresidentPlayerView,
    type PresidentView,
    RANK_VALUE,
} from "./president";

/** Suit tiebreak for hand order — keeps same-rank cards in a stable run. */
const SUIT_ORDER: Record<string, number> = {
    spades: 0,
    hearts: 1,
    clubs: 2,
    diamonds: 3,
};

/** Hand sort key: Président strength (3 low → 2 high), suit as tiebreak — so
 * the hand reads low→high and same-rank cards sit together for easy combos. */
function handOrder(card: CardDescriptor): number {
    if (card.type !== "suited") return -1;
    return RANK_VALUE[card.rank] * 10 + (SUIT_ORDER[card.suit] ?? 0);
}

/** Court cards get their localized name ("Dame"), pips stay as digits. */
function rankLabel(ctx: TableContext, rank: unknown): string {
    const r = String(rank);
    return r === "J" || r === "Q" || r === "K" || r === "A"
        ? ctx.t(`rank_${r}`)
        : r;
}

/** Title for a clean finish, when one exists ("Président", "Vice-Trou"…). */
/**
 * Canonical Président ladder, adjusted to the table size (`total` ranked
 * players): Président, Vice-Président, Neutre(s), Vice-Trou du cul, Trou du cul.
 * Vice titles need a 4th seat; everyone between the vices is Neutre. With 6
 * players the two middle seats are both Neutre. `place` is 1-based.
 */
function rankTitle(ctx: TableContext, place: number, total: number): string {
    if (place === 1) return ctx.t("place_president");
    if (place === total) return ctx.t("place_asshole");
    if (total >= 4 && place === 2) return ctx.t("place_vice_president");
    if (total >= 4 && place === total - 1) {
        return ctx.t("place_vice_asshole");
    }
    return ctx.t("place_neutral");
}

/** In-play badge title once a player has gone out (or was demoted on a 2) —
 * `null` while still holding cards. Same ladder as the game-over standings. */
function placeLabel(ctx: TableContext, p: PresidentPlayerView): string | null {
    if (p.demoted) return ctx.t("place_asshole");
    if (p.place === null) return null;
    return rankTitle(ctx, p.place, ctx.players.length);
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

    rankTitle: (rank, total, ctx) => rankTitle(ctx, rank, total),

    /**
     * Optimistic prediction of the viewer's own play/pass: the chosen cards
     * leave the hand and land on the trick immediately, no round-trip. The turn
     * is blanked so `mapView` stops treating it as ours (the fan and Pass
     * disable themselves) until the server reconciles. Trick-closing sweeps (a
     * 2, a carré, the last opponent passing) are the server's to settle — those
     * reconcile a beat later; the prediction only commits to the hand leaving.
     */
    predict(view, action, viewerId) {
        if (viewerId === null) return null;
        const a = action as PresidentAction;
        if (a.type !== "play" && a.type !== "pass") return null;
        const self = view.players.find((p) => p.playerId === viewerId);
        // Only the player on turn can act — guard a stale click from desyncing.
        if (!self || view.currentPlayerId !== viewerId) return null;

        if (a.type === "pass") {
            return {
                ...view,
                currentPlayerId: "",
                players: view.players.map((p) =>
                    p.playerId === viewerId ? { ...p, passed: true } : p,
                ),
            };
        }

        const hand = self.hand;
        if (!hand) return null;
        const playedKeys = new Set(a.cards.map(cardKey));
        // Every played card must really be in hand, or the click is stale.
        if (playedKeys.size !== a.cards.length) return null;
        if (![...playedKeys].every((k) => hand.some((c) => cardKey(c) === k))) {
            return null;
        }
        const first = a.cards[0];
        if (first?.type !== "suited") return null;

        const nextHand = hand.filter((c) => !playedKeys.has(cardKey(c)));
        // A fresh lead clears the just-won trick still on display; otherwise the
        // play stacks onto the running pile.
        const showingLast = view.pile.length === 0 && view.lastTrick.length > 0;
        const basePile = showingLast ? [] : view.pile;
        return {
            ...view,
            currentPlayerId: "",
            combo: { rank: first.rank, count: a.cards.length },
            pile: [...basePile, { playerId: viewerId, cards: a.cards }],
            lastTrick: showingLast ? [] : view.lastTrick,
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

        const banner = ctx.isOver
            ? ctx.t("game_over")
            : isYourTurn
              ? ctx.t("your_turn")
              : self
                ? ctx.t("waiting_for", {
                      name: playerName(ctx, view.currentPlayerId),
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
        // each card skinned with the deck style of the player who laid it. Once
        // a trick is swept we keep showing it (view.lastTrick) until the next
        // lead is laid, so a closing carré/2 is seen landing, not blinked away.
        const showingLast = view.pile.length === 0 && view.lastTrick.length > 0;
        const trickPlays = showingLast ? view.lastTrick : view.pile;
        const topPlay = trickPlays.at(-1);
        const zones: TableZoneInstance[] = [
            {
                key: "trick",
                zone: "trick",
                cards: trickPlays.flatMap((play) =>
                    play.cards.map((card) => ({
                        id: `trick:${cardKey(card)}`,
                        card,
                        ownerId: play.playerId,
                    })),
                ),
                caption: topPlay
                    ? showingLast
                        ? ctx.t("trick_won", {
                              name: playerName(ctx, topPlay.playerId),
                          })
                        : playerName(ctx, topPlay.playerId)
                    : undefined,
                emptyHint: ctx.t("in_play"),
            },
        ];

        // The payload's legal actions came from this module — safe narrow.
        const legal = ctx.legalActions as readonly PresidentAction[];

        // The hand is a combo picker: tap same-rank cards, then commit. Every
        // legal play is offered as a (rank, count) combo — leading exposes each
        // size 1…k, answering only the forced count. Cards of a rank with no
        // legal play at any size are flagged illegal.
        const plays: TableHandPlay[] = [];
        const seen = new Set<string>();
        const playableRanks = new Set<string>();
        for (const action of legal) {
            if (action.type !== "play") continue;
            const first = action.cards[0];
            const rank = first?.type === "suited" ? first.rank : null;
            if (rank === null) continue;
            playableRanks.add(rank);
            const key = `${rank}:${action.cards.length}`;
            if (seen.has(key)) continue;
            seen.add(key);
            plays.push({ group: rank, count: action.cards.length, action });
        }

        if (self?.hand) {
            const hand = [...self.hand].sort(
                (a, b) => handOrder(a) - handOrder(b),
            );
            zones.push({
                key: "hand",
                zone: "hand",
                cards: hand.map((card) => {
                    const rank = card.type === "suited" ? card.rank : undefined;
                    const playable =
                        rank !== undefined && playableRanks.has(rank);
                    return {
                        id: `hand:${cardKey(card)}`,
                        card,
                        group: playable ? rank : undefined,
                        // Your turn but this rank can't be played at any size:
                        // a blocked move, not an inert card — a click says why.
                        illegal: isYourTurn && !playable,
                    };
                }),
                badge: placeLabel(ctx, self) ?? undefined,
                selection: isYourTurn
                    ? { plays, playLabel: ctx.t("play") }
                    : undefined,
            });
        }

        // Pass stays: the verb you need when you can't or won't beat the trick,
        // not a card to lay. Combos are built by tapping the hand, not proposed.
        // It is shown to every seated player on every turn and simply greyed out
        // when it isn't theirs to use — a stable bar, no appearing/disappearing.
        const controls: TableControl[] = [];
        if (self) {
            const pass = legal.find((a) => a.type === "pass");
            controls.push({
                key: "pass",
                label: ctx.t("pass"),
                action: pass ?? { type: "pass", playerId: ctx.viewerId ?? "" },
                variant: "danger",
                disabled: !isYourTurn || !pass,
            });
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
        const name = playerName(
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
                if (place < 1) return ctx.t("log_finished", { name, place });
                const title = rankTitle(ctx, place, ctx.players.length);
                return ctx.t("log_finished_title", { name, title });
            }
            case "demoted":
                return ctx.t("log_demoted", { name });
            case "revolution":
                return p.active === true
                    ? ctx.t("log_revolution")
                    : ctx.t("log_counter_revolution");
            case "trick_cleared":
                return ctx.t("log_trick_cleared", {
                    name: playerName(
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
