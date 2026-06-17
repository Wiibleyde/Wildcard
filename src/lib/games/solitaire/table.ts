import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey, FACE_DOWN_CARD } from "@/lib/card/utils";
import {
    registerTable,
    type TableCardItem,
    type TableZoneInstance,
} from "../table/types";
import type { SolitaireAction, SolitaireView } from "./solitaire";

/** Empty-foundation hint: the suit it collects, so the board reads at a glance. */
const SUIT_SYMBOL: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

/** A card's drop destination → the action that completes the move there. */
type Drop = { readonly zoneKey: string; readonly action: SolitaireAction };

function suitOf(card: CardDescriptor): Suit | null {
    return card.type === "suited" ? card.suit : null;
}

/**
 * Solitaire table — stock, waste and the four foundations as `stack` piles on
 * top; the seven tableau columns as `cascade` runs in the centre. No seats, no
 * hand: it is a single-player board.
 *
 * Two ways to play every move, both built from `legalActions`:
 * - **Drag and drop** — each movable card carries its full set of `dropTargets`
 *   (one per legal destination, keyed by zone) plus the `dragStack` run that
 *   lifts out with it. Dropping on a foundation or column dispatches that
 *   target's action, so the *player* picks where it goes.
 * - **Double-click** — the same card carries its *best* move (foundation first,
 *   then the leftmost legal column) as the `action` auto-move shortcut.
 *
 * Drawing/recycling lives on a control button (single click), because the stock
 * pile is empty exactly when you need to recycle and an empty zone has nothing
 * to grab.
 */
export const solitaireTable = registerTable<SolitaireView>({
    zones: [
        { id: "stock", placement: "top", arrangement: "stack", cardSize: "sm" },
        { id: "waste", placement: "top", arrangement: "stack", cardSize: "sm" },
        {
            id: "foundation",
            placement: "top",
            arrangement: "stack",
            cardSize: "sm",
        },
        {
            // Seven columns share the board width (`fill`): cards size to the
            // column, so the tableau scales from 375px to 2K without wrapping.
            id: "tableau",
            placement: "center",
            arrangement: "cascade",
            fill: true,
        },
    ],

    mapView(view, ctx) {
        const legal = ctx.legalActions as readonly SolitaireAction[];
        const find = (
            match: (a: SolitaireAction) => boolean,
        ): SolitaireAction | undefined => legal.find(match);

        const banner = ctx.isOver ? ctx.t("you_win") : ctx.t("your_turn");

        // ── Stock: a face-down pile. Clicking anywhere on it draws a card, or
        //    recycles the waste once empty (the click lives on the zone, so it
        //    works even when there is no card left to click). ─────────────────
        const draw = find((a) => a.type === "draw");
        const stockSlots = Math.min(view.stockCount, 3);
        const stockCards: TableCardItem[] = Array.from(
            { length: stockSlots },
            (_, i) => ({
                id: `stock:${i}`,
                card: FACE_DOWN_CARD,
                faceDown: true,
            }),
        );

        // ── Waste: face-up pile; only the top is playable (drag or click) ───
        const wasteTop = view.waste.at(-1);
        const wasteAction =
            find((a) => a.type === "wasteToFoundation") ??
            find((a) => a.type === "wasteToTableau");
        const wasteDrops: Drop[] = [];
        if (wasteTop) {
            const s = suitOf(wasteTop);
            for (const a of legal) {
                if (a.type === "wasteToFoundation" && s) {
                    wasteDrops.push({ zoneKey: `foundation:${s}`, action: a });
                } else if (a.type === "wasteToTableau") {
                    wasteDrops.push({
                        zoneKey: `tableau:${a.column}`,
                        action: a,
                    });
                }
            }
        }
        const wasteCards: TableCardItem[] = view.waste.map((card, i) => {
            const isTop = i === view.waste.length - 1;
            return {
                id: `waste:${cardKey(card)}`,
                card,
                action: isTop ? wasteAction : undefined,
                dropTargets:
                    isTop && wasteDrops.length ? wasteDrops : undefined,
            };
        });

        // ── Tableau: hidden cards as backs, then the clickable face-up run ──
        const tableauZones: TableZoneInstance[] = view.tableau.map(
            (col, column) => {
                const downCards: TableCardItem[] = Array.from(
                    { length: col.downCount },
                    (_, k) => ({
                        id: `t${column}:down:${k}`,
                        card: FACE_DOWN_CARD,
                        faceDown: true,
                    }),
                );
                const upCards: TableCardItem[] = col.up.map((card, k) => {
                    const isTop = k === col.up.length - 1;
                    const count = col.up.length - k;
                    const s = suitOf(card);

                    // The run starting at this card can move to any column that
                    // accepts it; only a lone top card can also go up.
                    const drops: Drop[] = [];
                    const toFoundation =
                        isTop &&
                        find(
                            (a) =>
                                a.type === "tableauToFoundation" &&
                                a.column === column,
                        );
                    if (toFoundation && s) {
                        drops.push({
                            zoneKey: `foundation:${s}`,
                            action: toFoundation,
                        });
                    }
                    for (const a of legal) {
                        if (
                            a.type === "tableauToTableau" &&
                            a.from === column &&
                            a.count === count
                        ) {
                            drops.push({
                                zoneKey: `tableau:${a.to}`,
                                action: a,
                            });
                        }
                    }
                    // Auto-move shortcut (double-click): foundation first, else
                    // the leftmost legal column.
                    const action =
                        (toFoundation || undefined) ?? drops[0]?.action;

                    // The run that lifts out with this card (this card first).
                    const run = col.up.slice(k);
                    return {
                        id: `t${column}:up:${cardKey(card)}`,
                        card,
                        action,
                        dropTargets: drops.length ? drops : undefined,
                        dragStack:
                            run.length > 1
                                ? run.map((c) => ({
                                      id: `t${column}:up:${cardKey(c)}`,
                                      card: c,
                                  }))
                                : undefined,
                    };
                });
                return {
                    key: `tableau:${column}`,
                    zone: "tableau",
                    cards: [...downCards, ...upCards],
                    emptyHint: ctx.t("empty_column"),
                };
            },
        );

        const foundationZones: TableZoneInstance[] = view.foundations.map(
            (f) => {
                // A foundation top can be dragged back down onto the tableau.
                const drops: Drop[] = [];
                for (const a of legal) {
                    if (a.type === "foundationToTableau" && a.suit === f.suit) {
                        drops.push({
                            zoneKey: `tableau:${a.column}`,
                            action: a,
                        });
                    }
                }
                return {
                    key: `foundation:${f.suit}`,
                    zone: "foundation",
                    cards: f.top
                        ? [
                              {
                                  id: `foundation:${cardKey(f.top)}`,
                                  card: f.top,
                                  dropTargets: drops.length ? drops : undefined,
                              },
                          ]
                        : [],
                    emptyHint: SUIT_SYMBOL[f.suit],
                };
            },
        );

        return {
            banner: { label: banner, highlight: !ctx.isOver },
            zones: [
                {
                    key: "stock",
                    zone: "stock",
                    cards: stockCards,
                    caption: ctx.t("cards_left", { n: view.stockCount }),
                    emptyHint: ctx.t("recycle"),
                    // Draw / recycle — clicking the pile (or its empty slot).
                    action: draw,
                },
                { key: "waste", zone: "waste", cards: wasteCards },
                ...foundationZones,
                ...tableauZones,
            ],
            status: ctx.t("moves", { n: view.moves }),
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        switch (event.type) {
            case "to_foundation":
                return ctx.t("log_to_foundation", {
                    rank: String(p.rank ?? "?"),
                    suit: SUIT_SYMBOL[(p.suit as Suit) ?? "spades"],
                });
            case "recycle":
                return ctx.t("log_recycle");
            case "won":
                return ctx.t("you_win");
            // Draws and tableau shuffling are noise — keep the feed to progress.
            default:
                return null;
        }
    },
});
