import { french52 } from "@/lib/card/decks";
import { buildRankOrder, isSuited, suitColor } from "@/lib/card/rank";
import { type CardDescriptor, SUITS, type Suit } from "@/lib/card/types";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import { fail } from "@/lib/engine/rules";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    GameState,
} from "@/lib/engine/types";

/**
 * Solitaire (Klondike, draw-one) — the platform's first single-player module.
 *
 * It proves the engine contract is not multiplayer-bound: the same
 * `apply(state, action)` reducer drives a solo game, with `currentPlayerId`
 * pinned to the lone seat. More importantly it exercises `view()` as
 * defense-in-depth: the face-down stock and the face-down tableau cards are
 * redacted to *counts* even for their owner, so a tampered client can never
 * read tomorrow's draw — the server is the only place the order exists.
 *
 * Rules modelled: build the four foundations up by suit A→K; build the seven
 * tableau columns down in alternating colours; only a King fills an empty
 * column; the stock deals one card at a time to the waste and recycles
 * (unlimited redeals, order preserved) when exhausted. The game is won when
 * all 52 cards reach the foundations.
 */

/** A→K low-to-high (Ace low here — each game owns its order; see `buildRankOrder`).
 *  The Cavalier never appears in a french52 deck, so it stays 0. */
const ORDER = buildRankOrder([
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
]);

const COLUMNS = 7;
const FULL_FOUNDATION = 13;

/** One tableau column: hidden `down` cards under the visible `up` run. */
export interface SolitaireColumn {
    readonly down: readonly CardDescriptor[];
    readonly up: readonly CardDescriptor[];
}

export interface SolitaireState extends GameState {
    readonly phase: "playing" | "won";
    /** Face-down draw pile — top is the LAST element. Hidden from everyone. */
    readonly stock: readonly CardDescriptor[];
    /** Face-up discard — top (last) is the only playable waste card. */
    readonly waste: readonly CardDescriptor[];
    /** Four piles built up by suit, A→K. */
    readonly foundations: Readonly<Record<Suit, readonly CardDescriptor[]>>;
    readonly tableau: readonly SolitaireColumn[];
    /** Total moves played — the score (fewer is better). */
    readonly moves: number;
}

export type SolitaireAction =
    | { readonly type: "draw"; readonly playerId: string }
    | { readonly type: "wasteToFoundation"; readonly playerId: string }
    | {
          readonly type: "wasteToTableau";
          readonly playerId: string;
          readonly column: number;
      }
    | {
          readonly type: "tableauToFoundation";
          readonly playerId: string;
          readonly column: number;
      }
    | {
          readonly type: "tableauToTableau";
          readonly playerId: string;
          readonly from: number;
          readonly to: number;
          /** How many face-up cards (counted from the bottom of the run). */
          readonly count: number;
      }
    | {
          readonly type: "foundationToTableau";
          readonly playerId: string;
          readonly suit: Suit;
          readonly column: number;
      };

export interface SolitaireColumnView {
    readonly downCount: number;
    readonly up: readonly CardDescriptor[];
}

export interface SolitaireFoundationView {
    readonly suit: Suit;
    readonly top: CardDescriptor | null;
    readonly count: number;
}

export interface SolitaireView {
    readonly gameId: string;
    readonly phase: SolitaireState["phase"];
    readonly turn: number;
    readonly moves: number;
    /** Only the count leaks — the order stays server-side (anti-peek). */
    readonly stockCount: number;
    readonly waste: readonly CardDescriptor[];
    readonly foundations: readonly SolitaireFoundationView[];
    readonly tableau: readonly SolitaireColumnView[];
    /** The viewer this projection was built for (`null` = spectator). */
    readonly self: string | null;
}

// ── Rule predicates ───────────────────────────────────────────────────────

/** Can `card` land on its foundation right now? (Ace on empty, then up by suit.) */
function acceptsFoundation(
    foundations: SolitaireState["foundations"],
    card: CardDescriptor,
): boolean {
    if (!isSuited(card)) return false;
    const top = foundations[card.suit].at(-1);
    if (!top || !isSuited(top)) return ORDER[card.rank] === 1;
    return ORDER[card.rank] === ORDER[top.rank] + 1;
}

/** Can `card` (the bottom of a moved run) land on column `col`? */
function acceptsTableau(col: SolitaireColumn, card: CardDescriptor): boolean {
    if (!isSuited(card)) return false;
    const parent = col.up.at(-1);
    // An exposed `up` is always non-empty (we flip on empty), so no parent ⇒
    // the column is truly empty: only a King may move there.
    if (!parent) return ORDER[card.rank] === FULL_FOUNDATION;
    if (!isSuited(parent)) return false;
    return (
        suitColor(card.suit) !== suitColor(parent.suit) &&
        ORDER[card.rank] === ORDER[parent.rank] - 1
    );
}

/** A face-up run reads as a descending, alternating-colour sequence. */
function isValidRun(cards: readonly CardDescriptor[]): boolean {
    for (let i = 1; i < cards.length; i++) {
        const prev = cards[i - 1];
        const cur = cards[i];
        if (!isSuited(prev) || !isSuited(cur)) return false;
        if (
            suitColor(cur.suit) === suitColor(prev.suit) ||
            ORDER[cur.rank] !== ORDER[prev.rank] - 1
        ) {
            return false;
        }
    }
    return true;
}

/** Reveal the top hidden card once a column's face-up run is emptied. */
function flip(col: SolitaireColumn): SolitaireColumn {
    if (col.up.length === 0 && col.down.length > 0) {
        return {
            down: col.down.slice(0, -1),
            up: [col.down[col.down.length - 1]],
        };
    }
    return col;
}

function withColumn(
    tableau: readonly SolitaireColumn[],
    index: number,
    col: SolitaireColumn,
): SolitaireColumn[] {
    const next = [...tableau];
    next[index] = col;
    return next;
}

/**
 * Apply a validated field patch: bump move/turn counters, persist the RNG
 * cursor, and flip to "won" the moment every foundation is complete.
 */
function commit(
    state: SolitaireState,
    patch: Partial<SolitaireState>,
    events: GameEvent[],
    rng: Rng,
): ApplyResult<SolitaireState> {
    const merged = { ...state, ...patch };
    const won = SUITS.every(
        (s) => merged.foundations[s].length === FULL_FOUNDATION,
    );
    return {
        ok: true,
        state: {
            ...merged,
            moves: state.moves + 1,
            turn: state.turn + 1,
            rngState: rng.state,
            phase: won ? "won" : "playing",
            currentPlayerId: won ? null : state.currentPlayerId,
        },
        events: won ? [...events, { type: "won" }] : events,
    };
}

export const solitaire: GameModule<
    SolitaireState,
    SolitaireAction,
    SolitaireView
> = {
    id: "solitaire",
    name: "Solitaire",
    deck: french52,
    minPlayers: 1,
    maxPlayers: 1,

    setup(players, rng, seed, gameId) {
        const deck = rng.shuffle(buildDeck(french52));
        const tableau: SolitaireColumn[] = [];
        let cursor = 0;
        for (let col = 0; col < COLUMNS; col++) {
            const down = deck.slice(cursor, cursor + col);
            cursor += col;
            const up = [deck[cursor]];
            cursor += 1;
            tableau.push({ down, up });
        }
        return {
            gameId,
            players,
            phase: "playing",
            currentPlayerId: players[0].id,
            turn: 0,
            seed,
            rngState: rng.state,
            stock: deck.slice(cursor),
            waste: [],
            foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
            tableau,
            moves: 0,
        };
    },

    legalActions(state, playerId) {
        if (state.phase !== "playing") return [];
        if (state.players[0]?.id !== playerId) return [];

        const acts: SolitaireAction[] = [];

        // Draw one, or recycle the waste once the stock is empty.
        if (state.stock.length > 0 || state.waste.length > 0) {
            acts.push({ type: "draw", playerId });
        }

        const wasteTop = state.waste.at(-1);
        if (wasteTop) {
            if (acceptsFoundation(state.foundations, wasteTop)) {
                acts.push({ type: "wasteToFoundation", playerId });
            }
            state.tableau.forEach((col, column) => {
                if (acceptsTableau(col, wasteTop)) {
                    acts.push({ type: "wasteToTableau", playerId, column });
                }
            });
        }

        state.tableau.forEach((from, fromIdx) => {
            const top = from.up.at(-1);
            if (top && acceptsFoundation(state.foundations, top)) {
                acts.push({
                    type: "tableauToFoundation",
                    playerId,
                    column: fromIdx,
                });
            }
            // Every face-up suffix is a movable run (the up-run is always valid).
            for (let s = 0; s < from.up.length; s++) {
                const bottom = from.up[s];
                const count = from.up.length - s;
                const movesWholeColumn = s === 0 && from.down.length === 0;
                state.tableau.forEach((to, toIdx) => {
                    if (toIdx === fromIdx) return;
                    const toEmpty = to.up.length === 0 && to.down.length === 0;
                    // Shuffling a lone King between empty columns is no progress.
                    if (toEmpty && movesWholeColumn) return;
                    if (acceptsTableau(to, bottom)) {
                        acts.push({
                            type: "tableauToTableau",
                            playerId,
                            from: fromIdx,
                            to: toIdx,
                            count,
                        });
                    }
                });
            }
        });

        for (const suit of SUITS) {
            const top = state.foundations[suit].at(-1);
            if (!top) continue;
            state.tableau.forEach((col, column) => {
                if (acceptsTableau(col, top)) {
                    acts.push({
                        type: "foundationToTableau",
                        playerId,
                        suit,
                        column,
                    });
                }
            });
        }

        return acts;
    },

    apply(state, action, rng) {
        if (state.phase !== "playing") {
            return fail("game_over", "The game has already finished.");
        }
        if (state.players[0]?.id !== action.playerId) {
            return fail("not_a_player", "Actor is not seated in this game.");
        }

        switch (action.type) {
            case "draw": {
                if (state.stock.length === 0 && state.waste.length === 0) {
                    return fail(
                        "illegal_move",
                        "Stock and waste are both empty.",
                    );
                }
                if (state.stock.length > 0) {
                    // Deal one card face-up onto the waste (only the top plays).
                    const card = state.stock[state.stock.length - 1];
                    return commit(
                        state,
                        {
                            stock: state.stock.slice(0, -1),
                            waste: [...state.waste, card],
                        },
                        [{ type: "draw" }],
                        rng,
                    );
                }
                // Recycle: turn the waste back over, order preserved.
                return commit(
                    state,
                    { stock: [...state.waste].reverse(), waste: [] },
                    [{ type: "recycle" }],
                    rng,
                );
            }

            case "wasteToFoundation": {
                const card = state.waste.at(-1);
                if (!card) return fail("illegal_move", "The waste is empty.");
                if (!acceptsFoundation(state.foundations, card)) {
                    return fail("illegal_move", "Card cannot go up yet.");
                }
                if (!isSuited(card)) return fail("illegal_move", "Bad card.");
                return commit(
                    state,
                    {
                        waste: state.waste.slice(0, -1),
                        foundations: {
                            ...state.foundations,
                            [card.suit]: [
                                ...state.foundations[card.suit],
                                card,
                            ],
                        },
                    },
                    [
                        {
                            type: "to_foundation",
                            payload: { suit: card.suit, rank: card.rank },
                        },
                    ],
                    rng,
                );
            }

            case "wasteToTableau": {
                const card = state.waste.at(-1);
                if (!card) return fail("illegal_move", "The waste is empty.");
                const col = state.tableau[action.column];
                if (!col) return fail("illegal_move", "No such column.");
                if (!acceptsTableau(col, card)) {
                    return fail("illegal_move", "Card cannot land there.");
                }
                return commit(
                    state,
                    {
                        waste: state.waste.slice(0, -1),
                        tableau: withColumn(state.tableau, action.column, {
                            ...col,
                            up: [...col.up, card],
                        }),
                    },
                    [
                        {
                            type: "to_tableau",
                            payload: { column: action.column },
                        },
                    ],
                    rng,
                );
            }

            case "tableauToFoundation": {
                const col = state.tableau[action.column];
                if (!col) return fail("illegal_move", "No such column.");
                const card = col.up.at(-1);
                if (!card) return fail("illegal_move", "Empty column.");
                if (!acceptsFoundation(state.foundations, card)) {
                    return fail("illegal_move", "Card cannot go up yet.");
                }
                if (!isSuited(card)) return fail("illegal_move", "Bad card.");
                return commit(
                    state,
                    {
                        tableau: withColumn(
                            state.tableau,
                            action.column,
                            flip({ ...col, up: col.up.slice(0, -1) }),
                        ),
                        foundations: {
                            ...state.foundations,
                            [card.suit]: [
                                ...state.foundations[card.suit],
                                card,
                            ],
                        },
                    },
                    [
                        {
                            type: "to_foundation",
                            payload: { suit: card.suit, rank: card.rank },
                        },
                    ],
                    rng,
                );
            }

            case "tableauToTableau": {
                const from = state.tableau[action.from];
                const to = state.tableau[action.to];
                if (!from || !to || action.from === action.to) {
                    return fail("illegal_move", "Bad columns.");
                }
                if (action.count < 1 || action.count > from.up.length) {
                    return fail("illegal_move", "No such run.");
                }
                const run = from.up.slice(from.up.length - action.count);
                if (!isValidRun(run) || !acceptsTableau(to, run[0])) {
                    return fail("illegal_move", "Run cannot land there.");
                }
                return commit(
                    state,
                    {
                        tableau: withColumn(
                            withColumn(
                                state.tableau,
                                action.from,
                                flip({
                                    ...from,
                                    up: from.up.slice(
                                        0,
                                        from.up.length - action.count,
                                    ),
                                }),
                            ),
                            action.to,
                            { ...to, up: [...to.up, ...run] },
                        ),
                    },
                    [
                        {
                            type: "move",
                            payload: {
                                from: action.from,
                                to: action.to,
                                count: action.count,
                            },
                        },
                    ],
                    rng,
                );
            }

            case "foundationToTableau": {
                const card = state.foundations[action.suit].at(-1);
                if (!card) return fail("illegal_move", "Empty foundation.");
                const col = state.tableau[action.column];
                if (!col) return fail("illegal_move", "No such column.");
                if (!acceptsTableau(col, card)) {
                    return fail("illegal_move", "Card cannot land there.");
                }
                return commit(
                    state,
                    {
                        foundations: {
                            ...state.foundations,
                            [action.suit]: state.foundations[action.suit].slice(
                                0,
                                -1,
                            ),
                        },
                        tableau: withColumn(state.tableau, action.column, {
                            ...col,
                            up: [...col.up, card],
                        }),
                    },
                    [
                        {
                            type: "to_tableau",
                            payload: { column: action.column },
                        },
                    ],
                    rng,
                );
            }

            default:
                return fail(
                    "illegal_action",
                    `Unknown action "${(action as SolitaireAction).type}".`,
                );
        }
    },

    isOver(state) {
        return state.phase === "won";
    },

    outcome(state) {
        if (state.phase !== "won") return null;
        const player = state.players[0];
        return {
            rankings: [{ playerId: player.id, rank: 1, score: state.moves }],
            winners: [player.id],
        };
    },

    view(state, viewerId) {
        return {
            gameId: state.gameId,
            phase: state.phase,
            turn: state.turn,
            moves: state.moves,
            stockCount: state.stock.length,
            waste: state.waste,
            foundations: SUITS.map((suit) => ({
                suit,
                top: state.foundations[suit].at(-1) ?? null,
                count: state.foundations[suit].length,
            })),
            tableau: state.tableau.map((col) => ({
                downCount: col.down.length,
                up: col.up,
            })),
            self: viewerId,
        };
    },
};
