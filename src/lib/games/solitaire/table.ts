import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey, isRank, isSuit, SUIT_SYMBOL } from "@/lib/card/utils";
import { faceDownPile, turnBanner } from "../table/helpers";
import {
    registerTable,
    type TableBanner,
    type TableCardItem,
    type TableContext,
    type TableControl,
    type TableZoneInstance,
} from "../table/types";
import type {
    SolitaireAction,
    SolitaireColumnView,
    SolitaireFoundationView,
    SolitaireView,
} from "./solitaire";

type Drop = { readonly zoneKey: string; readonly action: SolitaireAction };

function suitOf(card: CardDescriptor): Suit | null {
    return card.type === "suited" ? card.suit : null;
}

function pushFoundation(
    foundations: readonly SolitaireFoundationView[],
    suit: Suit,
    card: CardDescriptor,
): SolitaireFoundationView[] {
    return foundations.map((f) =>
        f.suit === suit ? { ...f, top: card, count: f.count + 1 } : f,
    );
}

function replaceUp(
    tableau: readonly SolitaireColumnView[],
    column: number,
    up: readonly CardDescriptor[],
): SolitaireColumnView[] {
    return tableau.map((c, i) => (i === column ? { ...c, up } : c));
}

function appendUp(
    tableau: readonly SolitaireColumnView[],
    column: number,
    cards: readonly CardDescriptor[],
): SolitaireColumnView[] {
    return tableau.map((c, i) =>
        i === column ? { ...c, up: [...c.up, ...cards] } : c,
    );
}

function banner(view: SolitaireView, ctx: TableContext): TableBanner {
    if (view.phase === "won")
        return { label: ctx.t("you_win"), highlight: false };
    if (view.phase === "lost") {
        return { label: ctx.t("solitaire_resigned"), highlight: false };
    }
    // Solo game: always the seated player's turn; spectators are told so.
    return turnBanner(ctx, ctx.viewerId);
}

/**
 * Stock, waste and foundations as piles on top, the seven columns as
 * cascades. Every move is offered twice from `legalActions`: drag-and-drop
 * (`dropTargets`, the player picks the destination) and double-click (the
 * card's `action`: foundation first, else the leftmost column). Drawing and
 * recycling live on the stock zone itself, which stays clickable when empty.
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
            id: "tableau",
            placement: "center",
            arrangement: "cascade",
            fill: true,
        },
    ],

    /**
     * Not predicted (they reveal hidden cards): draw/autoFinish, a foundation
     * card coming back down, and emptying a column onto its face-down cards.
     */
    predict(view, action) {
        const a = action as SolitaireAction;
        switch (a.type) {
            case "wasteToFoundation": {
                const card = view.waste.at(-1);
                const s = card && suitOf(card);
                if (!card || !s) return null;
                return {
                    ...view,
                    waste: view.waste.slice(0, -1),
                    foundations: pushFoundation(view.foundations, s, card),
                };
            }
            case "wasteToTableau": {
                const card = view.waste.at(-1);
                if (!card) return null;
                return {
                    ...view,
                    waste: view.waste.slice(0, -1),
                    tableau: appendUp(view.tableau, a.column, [card]),
                };
            }
            case "tableauToFoundation": {
                const col = view.tableau[a.column];
                const card = col?.up.at(-1);
                const s = card && suitOf(card);
                if (!col || !card || !s) return null;
                if (col.up.length === 1 && col.downCount > 0) return null;
                return {
                    ...view,
                    foundations: pushFoundation(view.foundations, s, card),
                    tableau: replaceUp(
                        view.tableau,
                        a.column,
                        col.up.slice(0, -1),
                    ),
                };
            }
            case "tableauToTableau": {
                const from = view.tableau[a.from];
                if (!from || a.count < 1 || a.count > from.up.length) {
                    return null;
                }
                const cut = from.up.length - a.count;
                const run = from.up.slice(cut);
                const leftover = from.up.slice(0, cut);
                if (leftover.length === 0 && from.downCount > 0) return null;
                return {
                    ...view,
                    tableau: appendUp(
                        replaceUp(view.tableau, a.from, leftover),
                        a.to,
                        run,
                    ),
                };
            }
            default:
                return null;
        }
    },

    mapView(view, ctx) {
        const legal = ctx.legalActions as readonly SolitaireAction[];
        const find = (
            match: (a: SolitaireAction) => boolean,
        ): SolitaireAction | undefined => legal.find(match);

        const controls: TableControl[] = [];
        const autoFinish = find((a) => a.type === "autoFinish");
        if (autoFinish) {
            controls.push({
                key: "auto-finish",
                label: ctx.t("auto_finish"),
                action: autoFinish,
                variant: "success",
            });
        }
        const resign = find((a) => a.type === "resign");
        if (resign) {
            controls.push({
                key: "resign",
                label: ctx.t("solitaire_resign"),
                action: resign,
                variant: "danger",
                confirm: true,
            });
        }

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

        const tableauZones: TableZoneInstance[] = view.tableau.map(
            (col, column) => {
                const upCards: TableCardItem[] = col.up.map((card, k) => {
                    const isTop = k === col.up.length - 1;
                    const count = col.up.length - k;
                    const s = suitOf(card);

                    // The run from this card can go to any accepting column;
                    // only a lone top card can also go up.
                    const drops: Drop[] = [];
                    const toFoundation = isTop
                        ? find(
                              (a) =>
                                  a.type === "tableauToFoundation" &&
                                  a.column === column,
                          )
                        : undefined;
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

                    const run = col.up.slice(k);
                    return {
                        id: `t${column}:up:${cardKey(card)}`,
                        card,
                        action: toFoundation ?? drops[0]?.action,
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
                    cards: [
                        ...faceDownPile(`t${column}:down`, col.downCount),
                        ...upCards,
                    ],
                    emptyHint: ctx.t("empty_column"),
                };
            },
        );

        const foundationZones: TableZoneInstance[] = view.foundations.map(
            (f) => {
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
            banner: banner(view, ctx),
            zones: [
                {
                    key: "stock",
                    zone: "stock",
                    cards: faceDownPile("stock", Math.min(view.stockCount, 3)),
                    caption: ctx.t("cards_left", { n: view.stockCount }),
                    emptyHint: ctx.t("recycle"),
                    action: find((a) => a.type === "draw"),
                },
                { key: "waste", zone: "waste", cards: wasteCards },
                ...foundationZones,
                ...tableauZones,
            ],
            controls: controls.length ? controls : undefined,
            status: ctx.t("moves", { n: view.moves }),
        };
    },

    logLine(event, ctx) {
        const p = event.payload ?? {};
        switch (event.type) {
            case "to_foundation":
                // The auto-finish floods the feed; its "won" line covers it.
                if (p.auto) return null;
                return ctx.t("log_to_foundation", {
                    rank: isRank(p.rank) ? p.rank : "?",
                    suit: isSuit(p.suit) ? SUIT_SYMBOL[p.suit] : "?",
                });
            case "recycle":
                return ctx.t("log_recycle");
            case "won":
                return ctx.t("you_win");
            case "resigned":
                return ctx.t("solitaire_resigned");
            default:
                return null;
        }
    },
});
