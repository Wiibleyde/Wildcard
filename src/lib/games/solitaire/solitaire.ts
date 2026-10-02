import { french52 } from "@/lib/card/decks";
import { buildRankOrder, isSuited, suitColor } from "@/lib/card/rank";
import {
    type CardDescriptor,
    SUITS,
    type Suit,
    type SuitedCard,
} from "@/lib/card/types";
import { isSuit } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
import { bindRules, defineRules, fail } from "@/lib/engine/rules";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    GameRuleMode,
    GameState,
} from "@/lib/engine/types";

/*
 * Solitaire (Klondike) — the single-player proof. Its `view()` redacts the
 * stock and face-down tableau cards to COUNTS even for their owner: a
 * tampered client can never read the next draw.
 *
 * Variants (https://en.wikipedia.org/wiki/Klondike_(solitaire)): `drawThree`
 * turns three stock cards at a time; `limitedPasses` (« Vegas ») allows one
 * pass in draw-one, three in draw-three. Unlimited redeals mean a stuck board
 * never ends on its own, hence `resign`.
 */

/** A → K: Ace low here. */
const RANKS = french52.ranks;
const ORDER = buildRankOrder(RANKS);

const COLUMNS = 7;
const FULL_FOUNDATION = RANKS.length;

interface SolitaireRules {
    readonly drawThree: boolean;
    readonly limitedPasses: boolean;
}

const DEFAULT_SOLITAIRE_RULES: SolitaireRules = {
    drawThree: false,
    limitedPasses: false,
};

const SOLITAIRE_RULE_MODES: readonly GameRuleMode[] = [
    {
        key: "solitaire_classic",
        rules: { drawThree: false, limitedPasses: false },
    },
    {
        key: "solitaire_draw3",
        rules: { drawThree: true, limitedPasses: false },
    },
    {
        key: "solitaire_vegas",
        rules: { drawThree: false, limitedPasses: true },
    },
    {
        key: "solitaire_vegas3",
        rules: { drawThree: true, limitedPasses: true },
    },
];

function rulesOf(state: SolitaireState): SolitaireRules {
    return state.rules ?? DEFAULT_SOLITAIRE_RULES;
}

function drawSize(state: SolitaireState): number {
    return rulesOf(state).drawThree ? 3 : 1;
}

function canRecycle(state: SolitaireState): boolean {
    if (state.stock.length > 0 || state.waste.length === 0) return false;
    const rules = rulesOf(state);
    if (!rules.limitedPasses) return true;
    const maxRedeals = rules.drawThree ? 2 : 0;
    return (state.redeals ?? 0) < maxRedeals;
}

function bySuit<T>(make: (suit: Suit) => T): Record<Suit, T> {
    return {
        spades: make("spades"),
        hearts: make("hearts"),
        diamonds: make("diamonds"),
        clubs: make("clubs"),
    };
}

export interface SolitaireColumn {
    readonly down: readonly CardDescriptor[];
    readonly up: readonly CardDescriptor[];
}

export interface SolitaireState extends GameState {
    readonly phase: "playing" | "won" | "lost";
    /** Top is the LAST element. Hidden from everyone. */
    readonly stock: readonly CardDescriptor[];
    /** Only the top (last) card plays. */
    readonly waste: readonly CardDescriptor[];
    readonly foundations: Readonly<Record<Suit, readonly CardDescriptor[]>>;
    readonly tableau: readonly SolitaireColumn[];
    /** The score (fewer is better). */
    readonly moves: number;
    /** Absent on games recorded before rules existed (= classic rules). */
    readonly rules?: SolitaireRules;
    /** Waste → stock recycles; tracked only when rules are bound. */
    readonly redeals?: number;
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
          /** Face-up cards moved, counted from the bottom of the run. */
          readonly count: number;
      }
    | {
          readonly type: "foundationToTableau";
          readonly playerId: string;
          readonly suit: Suit;
          readonly column: number;
      }
    /** Legal only once the win is assured (re-checked server-side). */
    | { readonly type: "autoFinish"; readonly playerId: string }
    | { readonly type: "resign"; readonly playerId: string };

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
    /** Only the count leaks — the order stays server-side. */
    readonly stockCount: number;
    readonly waste: readonly CardDescriptor[];
    readonly foundations: readonly SolitaireFoundationView[];
    readonly tableau: readonly SolitaireColumnView[];
    readonly self: string | null;
}

/** Untrusted index: rejects `"length"`, `1.5`, `-1`, `"0"`… */
function isColumn(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < COLUMNS
    );
}

/** `card` narrowed when it can go up to its foundation now, else `null`. */
function acceptsFoundation(
    foundations: SolitaireState["foundations"],
    card: CardDescriptor,
): SuitedCard | null {
    if (!isSuited(card)) return null;
    const top = foundations[card.suit].at(-1);
    if (!top || !isSuited(top)) return card.rank === "A" ? card : null;
    return ORDER[card.rank] === ORDER[top.rank] + 1 ? card : null;
}

/** Can a run starting with `card` land on `col`? Only a King fills an empty column. */
function acceptsTableau(col: SolitaireColumn, card: CardDescriptor): boolean {
    if (!isSuited(card)) return false;
    // A non-empty column always shows a face-up card (we flip on empty).
    const parent = col.up.at(-1);
    if (!parent) return card.rank === "K";
    if (!isSuited(parent)) return false;
    return (
        suitColor(card.suit) !== suitColor(parent.suit) &&
        ORDER[card.rank] === ORDER[parent.rank] - 1
    );
}

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

/**
 * With no face-down tableau card left (and, outside draw-one unlimited, an
 * empty stock and waste), every remaining card is reachable and greedily
 * sending the lowest one up always completes — the rest is busywork.
 */
function isWinAssured(state: SolitaireState): boolean {
    if (state.phase !== "playing") return false;
    if (!state.tableau.every((col) => col.down.length === 0)) return false;
    // Draw-three can bury a card behind the cadence; a spent Vegas stock is gone.
    const rules = rulesOf(state);
    if (!rules.drawThree && !rules.limitedPasses) return true;
    return state.stock.length === 0 && state.waste.length === 0;
}

function fullFoundation(suit: Suit): CardDescriptor[] {
    return RANKS.map((rank) => ({ type: "suited", suit, rank }) as const);
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

function withFoundationCard(
    foundations: SolitaireState["foundations"],
    card: SuitedCard,
): SolitaireState["foundations"] {
    return {
        ...foundations,
        [card.suit]: [...foundations[card.suit], card],
    };
}

/** Count the move and flip to "won" once every foundation is complete. */
function commit(
    state: SolitaireState,
    patch: Partial<SolitaireState>,
    events: GameEvent[],
): ApplyResult<SolitaireState> {
    const merged = { ...state, ...patch };
    const won = SUITS.every(
        (suit) => merged.foundations[suit].length === FULL_FOUNDATION,
    );
    return {
        ok: true,
        state: {
            ...merged,
            moves: state.moves + 1,
            phase: won ? "won" : "playing",
            currentPlayerId: won ? null : state.currentPlayerId,
        },
        events: won ? [...events, { type: "won" }] : events,
    };
}

const base: Omit<
    GameModule<SolitaireState, SolitaireAction, SolitaireView>,
    "setup"
> = {
    id: "solitaire",
    name: "Solitaire",
    deck: french52,
    minPlayers: 1,
    maxPlayers: 1,
    ruleToggles: defineRules(DEFAULT_SOLITAIRE_RULES),
    ruleModes: SOLITAIRE_RULE_MODES,

    legalActions(state, playerId) {
        if (state.phase !== "playing") return [];
        if (state.players[0]?.id !== playerId) return [];

        const acts: SolitaireAction[] = [];

        if (isWinAssured(state)) {
            acts.push({ type: "autoFinish", playerId });
        }

        if (state.stock.length > 0 || canRecycle(state)) {
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
                    // A lone King hopping between empty columns is no progress.
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

        acts.push({ type: "resign", playerId });

        return acts;
    },

    apply(state, action) {
        const { type } = action;
        switch (action.type) {
            case "draw": {
                if (state.stock.length > 0) {
                    // Top of the stock first: the last one turned is the playable top.
                    const n = Math.min(drawSize(state), state.stock.length);
                    const turned = state.stock.slice(-n).reverse();
                    return commit(
                        state,
                        {
                            stock: state.stock.slice(0, -n),
                            waste: [...state.waste, ...turned],
                        },
                        [{ type: "draw", payload: { count: n } }],
                    );
                }
                if (!canRecycle(state)) {
                    return fail(
                        "illegal_move",
                        state.waste.length === 0
                            ? "Stock and waste are both empty."
                            : "No passes left through the stock.",
                    );
                }
                return commit(
                    state,
                    {
                        stock: [...state.waste].reverse(),
                        waste: [],
                        ...(state.redeals === undefined
                            ? {}
                            : { redeals: state.redeals + 1 }),
                    },
                    [{ type: "recycle" }],
                );
            }

            case "wasteToFoundation": {
                const top = state.waste.at(-1);
                if (!top) return fail("illegal_move", "The waste is empty.");
                const card = acceptsFoundation(state.foundations, top);
                if (!card) {
                    return fail("illegal_move", "Card cannot go up yet.");
                }
                return commit(
                    state,
                    {
                        waste: state.waste.slice(0, -1),
                        foundations: withFoundationCard(
                            state.foundations,
                            card,
                        ),
                    },
                    [
                        {
                            type: "to_foundation",
                            payload: { suit: card.suit, rank: card.rank },
                        },
                    ],
                );
            }

            case "wasteToTableau": {
                if (!isColumn(action.column)) {
                    return fail("illegal_move", "No such column.");
                }
                const card = state.waste.at(-1);
                if (!card) return fail("illegal_move", "The waste is empty.");
                const col = state.tableau[action.column];
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
                );
            }

            case "tableauToFoundation": {
                if (!isColumn(action.column)) {
                    return fail("illegal_move", "No such column.");
                }
                const col = state.tableau[action.column];
                const top = col.up.at(-1);
                if (!top) return fail("illegal_move", "Empty column.");
                const card = acceptsFoundation(state.foundations, top);
                if (!card) {
                    return fail("illegal_move", "Card cannot go up yet.");
                }
                return commit(
                    state,
                    {
                        tableau: withColumn(
                            state.tableau,
                            action.column,
                            flip({ ...col, up: col.up.slice(0, -1) }),
                        ),
                        foundations: withFoundationCard(
                            state.foundations,
                            card,
                        ),
                    },
                    [
                        {
                            type: "to_foundation",
                            payload: { suit: card.suit, rank: card.rank },
                        },
                    ],
                );
            }

            case "tableauToTableau": {
                if (
                    !isColumn(action.from) ||
                    !isColumn(action.to) ||
                    action.from === action.to
                ) {
                    return fail("illegal_move", "Bad columns.");
                }
                const from = state.tableau[action.from];
                const to = state.tableau[action.to];
                if (
                    !Number.isInteger(action.count) ||
                    action.count < 1 ||
                    action.count > from.up.length
                ) {
                    return fail("illegal_move", "No such run.");
                }
                const run = from.up.slice(from.up.length - action.count);
                if (!isValidRun(run) || !acceptsTableau(to, run[0])) {
                    return fail("illegal_move", "Run cannot land there.");
                }
                const toEmpty = to.up.length === 0 && to.down.length === 0;
                if (
                    toEmpty &&
                    action.count === from.up.length &&
                    from.down.length === 0
                ) {
                    return fail("illegal_move", "That move changes nothing.");
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
                );
            }

            case "foundationToTableau": {
                if (!isSuit(action.suit)) {
                    return fail("illegal_move", "No such foundation.");
                }
                if (!isColumn(action.column)) {
                    return fail("illegal_move", "No such column.");
                }
                const card = state.foundations[action.suit].at(-1);
                if (!card) return fail("illegal_move", "Empty foundation.");
                const col = state.tableau[action.column];
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
                );
            }

            case "autoFinish": {
                if (!isWinAssured(state)) {
                    return fail(
                        "illegal_move",
                        "The win is not assured — cards are still hidden.",
                    );
                }
                // One event per card, low to high, so the board animates a
                // cascade and the score counts each move as if played by hand.
                const remaining = [
                    ...state.stock,
                    ...state.waste,
                    ...state.tableau.flatMap((col) => col.up),
                ]
                    .filter(isSuited)
                    .sort(
                        (a, b) =>
                            ORDER[a.rank] - ORDER[b.rank] ||
                            SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit),
                    );
                const events: GameEvent[] = remaining.map((card) => ({
                    type: "to_foundation",
                    payload: { suit: card.suit, rank: card.rank, auto: true },
                }));
                return {
                    ok: true,
                    state: {
                        ...state,
                        stock: [],
                        waste: [],
                        foundations: bySuit(fullFoundation),
                        tableau: state.tableau.map(() => ({
                            down: [],
                            up: [],
                        })),
                        moves: state.moves + remaining.length,
                        phase: "won",
                        currentPlayerId: null,
                    },
                    events: [...events, { type: "won" }],
                };
            }

            case "resign":
                // Not a move: the counters stay as played.
                return {
                    ok: true,
                    state: { ...state, phase: "lost", currentPlayerId: null },
                    events: [{ type: "resigned" }],
                };

            default:
                return fail("illegal_action", `Unknown action "${type}".`);
        }
    },

    isOver(state) {
        return state.phase !== "playing";
    },

    outcome(state) {
        if (state.phase === "playing") return null;
        const player = state.players[0];
        // A resignation keeps the single ranking but lists no winner.
        return {
            rankings: [{ playerId: player.id, rank: 1, score: state.moves }],
            winners: state.phase === "won" ? [player.id] : [],
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

/** The unbound module stamps no rules — how pre-rules games were dealt, so they replay. */
function createSolitaire(
    rules?: SolitaireRules,
): GameModule<SolitaireState, SolitaireAction, SolitaireView> {
    return {
        ...base,
        withRules(chosen) {
            return createSolitaire(bindRules(chosen, DEFAULT_SOLITAIRE_RULES));
        },
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
                foundations: bySuit(() => []),
                tableau,
                moves: 0,
                ...(rules ? { rules, redeals: 0 } : {}),
            };
        },
    };
}

export const solitaire = createSolitaire();
