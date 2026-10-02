import type { CardDescriptor } from "@/lib/card/types";
import {
    cardKey,
    isRank,
    rankLabel,
    SUIT_DISPLAY_ORDER,
} from "@/lib/card/utils";
import { playerName, seatChips, turnBanner } from "../table/helpers";
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

/** Low → high, same-rank cards together for easy combos. */
function handOrder(card: CardDescriptor): number {
    if (card.type !== "suited") return -1;
    return RANK_VALUE[card.rank] * 10 + SUIT_DISPLAY_ORDER[card.suit];
}

/** Président ladder sized to the table: vice titles need a 4th seat, the middle is Neutre. */
function rankTitle(ctx: TableContext, place: number, total: number): string {
    if (place === 1) return ctx.t("place_president");
    if (place === total) return ctx.t("place_asshole");
    if (total >= 4 && place === 2) return ctx.t("place_vice_president");
    if (total >= 4 && place === total - 1) {
        return ctx.t("place_vice_asshole");
    }
    return ctx.t("place_neutral");
}

/** Title once out of the round (demoted ⇒ Trou du cul); `null` while holding cards. */
function placeLabel(ctx: TableContext, p: PresidentPlayerView): string | null {
    if (p.demoted) return ctx.t("place_asshole");
    if (p.place === null) return null;
    return rankTitle(ctx, p.place, ctx.players.length);
}

function payloadRank(ctx: TableContext, rank: unknown): string {
    return isRank(rank) ? rankLabel(ctx.t, rank) : "?";
}

export const presidentTable = registerTable<PresidentView, PresidentAction>({
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
     * The played cards leave the hand and land on the trick; sweeps (a 2, a
     * carré, the last pass) are left to the server.
     */
    predict(view, a, viewerId) {
        if (viewerId === null) return null;
        if (a.type !== "play" && a.type !== "pass") return null;
        const self = view.players.find((p) => p.playerId === viewerId);
        if (!self || view.currentPlayerId !== viewerId) return null;

        if (a.type === "pass") {
            return {
                ...view,
                currentPlayerId: null,
                players: view.players.map((p) =>
                    p.playerId === viewerId ? { ...p, passed: true } : p,
                ),
            };
        }

        const hand = self.hand;
        if (!hand) return null;
        const playedKeys = new Set(a.cards.map(cardKey));
        if (playedKeys.size !== a.cards.length) return null;
        // The hand's own copies, mirroring the server — never the action's.
        const played = hand.filter((c) => playedKeys.has(cardKey(c)));
        if (played.length !== playedKeys.size) return null;
        const first = played[0];
        if (first?.type !== "suited") return null;

        const nextHand = hand.filter((c) => !playedKeys.has(cardKey(c)));
        const pile = [...view.pile, { playerId: viewerId, cards: played }];
        return {
            ...view,
            currentPlayerId: null,
            combo: { rank: first.rank, count: played.length },
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
        const banner = turnBanner(ctx, view.currentPlayerId);
        const isYourTurn = banner.highlight;

        const seats = seatChips(
            view.players,
            ctx,
            view.currentPlayerId,
            (p) =>
                placeLabel(ctx, p) ??
                (p.passed
                    ? ctx.t("passed")
                    : ctx.t("cards_left", { n: p.handCount })),
        );

        const { plays, wonBy } = view.displayTrick;
        const top = plays.at(-1);
        const zones: TableZoneInstance[] = [
            {
                key: "trick",
                zone: "trick",
                cards: plays.flatMap((play) =>
                    play.cards.map((card) => ({
                        id: `trick:${cardKey(card)}`,
                        card,
                        ownerId: play.playerId,
                    })),
                ),
                caption: wonBy
                    ? ctx.t("trick_won", { name: playerName(ctx, wonBy) })
                    : top
                      ? playerName(ctx, top.playerId)
                      : undefined,
                emptyHint: ctx.t("in_play"),
            },
        ];

        // Legal actions come from this module — safe narrow.
        const legal = ctx.legalActions;

        // Combo picker: one (rank, count) entry per legal play; a rank with
        // no legal play at any size is flagged illegal on your turn.
        const handPlays: TableHandPlay[] = [];
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
            handPlays.push({ group: rank, count: action.cards.length, action });
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
                        illegal: isYourTurn && !playable,
                    };
                }),
                badge: placeLabel(ctx, self) ?? undefined,
                selection: isYourTurn
                    ? { plays: handPlays, playLabel: ctx.t("play") }
                    : undefined,
            });
        }

        // Pass is always shown to seated players, greyed out off-turn: a stable bar.
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
            banner,
            seats,
            zones,
            controls,
            status: view.revolution
                ? ctx.t("revolution")
                : view.equalLock && view.combo
                  ? ctx.t("or_nothing_status", {
                        rank: rankLabel(ctx.t, view.combo.rank),
                    })
                  : undefined,
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        const name = playerName(ctx, p.playerId);
        switch (event.type) {
            case "played": {
                const rank = payloadRank(ctx, p.rank);
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
                    rank: payloadRank(ctx, p.rank),
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
                    name: playerName(ctx, p.leadPlayerId),
                });
            case "game_over":
                return ctx.t("game_over");
            default:
                return null;
        }
    },
});
