import { french52 } from "@/lib/card/decks";
import { buildRankOrder, isSuited, suitColor } from "@/lib/card/rank";
import {
    type CardDescriptor,
    type Rank,
    SUITS,
    type Suit,
} from "@/lib/card/types";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import { fail } from "@/lib/engine/rules";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    GameRuleMode,
    GameRuleToggle,
    GameState,
} from "@/lib/engine/types";

/**
 * Solitaire (Klondike) — the platform's first single-player module.
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
 * column; the stock deals to the waste and recycles (order preserved) when
 * exhausted. The game is won when all 52 cards reach the foundations.
 *
 * Variants (https://en.wikipedia.org/wiki/Klondike_(solitaire)) — Klondike has
 * no French-specific rulebook, so the default is the classic draw-one,
 * unlimited-redeal deal:
 * - `drawThree` — the stock turns three cards at a time (only the top of the
 *   waste plays), the harder Windows-style game.
 * - `limitedPasses` — « Vegas »: a single pass through the stock in draw-one,
 *   three passes (two redeals) in draw-three.
 *
 * Not every Klondike deal is winnable, and unlimited redeals mean a stuck board
 * never ends on its own — so the player may `resign`, closing the game as a
 * loss (phase "lost") and letting the room finish.
 */

/** A→K low-to-high (Ace low here — each game owns its order; see `buildRankOrder`).
 *  The Cavalier never appears in a french52 deck, so it stays 0. */
const RANKS: readonly Rank[] = [
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
];
const ORDER = buildRankOrder(RANKS);

const COLUMNS = 7;
const FULL_FOUNDATION = 13;

/** Table rules (see the module doc). */
export interface SolitaireRules {
    /** Turn three stock cards at a time instead of one. */
    readonly drawThree: boolean;
    /** Vegas: one pass in draw-one, three passes in draw-three. */
    readonly limitedPasses: boolean;
}

export const DEFAULT_SOLITAIRE_RULES: SolitaireRules = {
    drawThree: false,
    limitedPasses: false,
};

export const SOLITAIRE_RULE_TOGGLES: readonly GameRuleToggle[] = [
    { key: "drawThree", default: false },
    { key: "limitedPasses", default: false },
];

/** Launch presets — classic draw-one first (the default). */
export const SOLITAIRE_RULE_MODES: readonly GameRuleMode[] = [
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

/** Cards turned per draw under the game's rules. */
function drawSize(state: SolitaireState): number {
    return rulesOf(state).drawThree ? 3 : 1;
}

/** May the waste be turned back into the stock once more? */
function canRecycle(state: SolitaireState): boolean {
    if (state.stock.length > 0 || state.waste.length === 0) return false;
    const rules = rulesOf(state);
    if (!rules.limitedPasses) return true;
    // Vegas: 1 pass (0 redeals) in draw-one, 3 passes (2 redeals) in draw-three.
    const maxRedeals = rules.drawThree ? 2 : 0;
    return (state.redeals ?? 0) < maxRedeals;
}

/** One tableau column: hidden `down` cards under the visible `up` run. */
export interface SolitaireColumn {
    readonly down: readonly CardDescriptor[];
    readonly up: readonly CardDescriptor[];
}

export interface SolitaireState extends GameState {
    readonly phase: "playing" | "won" | "lost";
    /** Face-down draw pile — top is the LAST element. Hidden from everyone. */
    readonly stock: readonly CardDescriptor[];
    /** Face-up discard — top (last) is the only playable waste card. */
    readonly waste: readonly CardDescriptor[];
    /** Four piles built up by suit, A→K. */
    readonly foundations: Readonly<Record<Suit, readonly CardDescriptor[]>>;
    readonly tableau: readonly SolitaireColumn[];
    /** Total moves played — the score (fewer is better). */
    readonly moves: number;
    /** Table rules this game was dealt with. Absent on games recorded before
     * rules existed — those used the classic rules, the default. */
    readonly rules?: SolitaireRules;
    /** Waste → stock recycles so far (tracked only when rules are bound). */
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
          /** How many face-up cards (counted from the bottom of the run). */
          readonly count: number;
      }
    | {
          readonly type: "foundationToTableau";
          readonly playerId: string;
          readonly suit: Suit;
          readonly column: number;
      }
    /**
     * Auto-complete the deal in one shot. Legal *only* when the win is already
     * assured (see {@link isWinAssured}); the server still re-checks, so a
     * tampered client can never use it to skip a genuinely unsolved board.
     */
    | { readonly type: "autoFinish"; readonly playerId: string }
    /** Give up an unwinnable (or unwanted) deal — ends the game as a loss. */
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
    /** Only the count leaks — the order stays server-side (anti-peek). */
    readonly stockCount: number;
    readonly waste: readonly CardDescriptor[];
    readonly foundations: readonly SolitaireFoundationView[];
    readonly tableau: readonly SolitaireColumnView[];
    /** The viewer this projection was built for (`null` = spectator). */
    readonly self: string | null;
}

// ── Payload validation ────────────────────────────────────────────────────

/** A real tableau column index — rejects `"length"`, `1.5`, `-1`, `"0"`…
 * (client payloads are untrusted; a bad key must fail, never throw). */
function isColumn(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < COLUMNS
    );
}

function isSuit(value: unknown): value is Suit {
    return (
        typeof value === "string" &&
        (SUITS as readonly string[]).includes(value)
    );
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

/**
 * Is the rest of the game a foregone conclusion? In draw-one Klondike with
 * unlimited redeals, once no tableau card is still face-down every remaining
 * card is reachable (tableau tops are each column's lowest card; the whole
 * stock can be cycled freely to the waste), and the foundations only ever climb
 * — so greedily sending the lowest playable card up always completes. That is
 * exactly the gate for the one-click finish: the player has "already won", the
 * remaining moves are pure busywork, so we let them skip straight to the end.
 *
 * Crucially this is *not* a shortcut past an unsolved board: a hidden card means
 * an unknown future, so the win is not assured and the action stays illegal.
 */
function isWinAssured(state: SolitaireState): boolean {
    if (state.phase !== "playing") return false;
    if (!state.tableau.every((col) => col.down.length === 0)) return false;
    // The "whole stock is reachable" argument only holds for draw-one with
    // unlimited redeals: three-at-a-time can bury a card behind the cadence,
    // and a spent Vegas stock is gone. Otherwise demand an empty stock.
    const rules = rulesOf(state);
    if (!rules.drawThree && !rules.limitedPasses) return true;
    return state.stock.length === 0 && state.waste.length === 0;
}

/** A complete A→K foundation pile for `suit` (the finished state of each suit). */
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
        (suit) => merged.foundations[suit].length === FULL_FOUNDATION,
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

const base: Omit<
    GameModule<SolitaireState, SolitaireAction, SolitaireView>,
    "setup"
> = {
    id: "solitaire",
    name: "Solitaire",
    deck: french52,
    minPlayers: 1,
    maxPlayers: 1,
    ruleToggles: SOLITAIRE_RULE_TOGGLES,
    ruleModes: SOLITAIRE_RULE_MODES,

    legalActions(state, playerId) {
        if (state.phase !== "playing") return [];
        if (state.players[0]?.id !== playerId) return [];

        const acts: SolitaireAction[] = [];

        // One-click finish — offered only when the win is already locked in.
        if (isWinAssured(state)) {
            acts.push({ type: "autoFinish", playerId });
        }

        // Draw, or recycle the waste once the stock is empty (if allowed).
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

        // Always available while playing: the way out of an unwinnable deal.
        acts.push({ type: "resign", playerId });

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
                if (state.stock.length > 0) {
                    // Turn one (or three) cards face-up onto the waste, top of
                    // the stock first — the last one turned is the playable top.
                    const n = Math.min(drawSize(state), state.stock.length);
                    const turned = state.stock.slice(-n).reverse();
                    return commit(
                        state,
                        {
                            stock: state.stock.slice(0, -n),
                            waste: [...state.waste, ...turned],
                        },
                        [{ type: "draw", payload: { count: n } }],
                        rng,
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
                // Recycle: turn the waste back over, order preserved.
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
                    rng,
                );
            }

            case "tableauToFoundation": {
                if (!isColumn(action.column)) {
                    return fail("illegal_move", "No such column.");
                }
                const col = state.tableau[action.column];
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
                // Moving a whole column (nothing hidden beneath) into an empty
                // one changes nothing — refused, matching `legalActions`.
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
                    rng,
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
                    rng,
                );
            }

            case "autoFinish": {
                // Server-side re-check: the client may offer the button, but the
                // truth lives here — a hidden card forbids the shortcut.
                if (!isWinAssured(state)) {
                    return fail(
                        "illegal_move",
                        "The win is not assured — cards are still hidden.",
                    );
                }
                // Every card not yet up there (no down cards remain, so this is
                // every loose card) climbs to its foundation. We emit one event
                // per card, ordered low-to-high, so the board animates a quick
                // cascade and the move counter ticks up for each — same score as
                // playing it out by hand.
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
                        foundations: {
                            spades: fullFoundation("spades"),
                            hearts: fullFoundation("hearts"),
                            diamonds: fullFoundation("diamonds"),
                            clubs: fullFoundation("clubs"),
                        },
                        tableau: state.tableau.map(() => ({
                            down: [],
                            up: [],
                        })),
                        moves: state.moves + remaining.length,
                        turn: state.turn + remaining.length,
                        rngState: rng.state,
                        phase: "won",
                        currentPlayerId: null,
                    },
                    events: [...events, { type: "won" }],
                };
            }

            case "resign":
                // Not a move: the counters stay as played, the deal just ends.
                return {
                    ok: true,
                    state: {
                        ...state,
                        turn: state.turn + 1,
                        rngState: rng.state,
                        phase: "lost",
                        currentPlayerId: null,
                    },
                    events: [{ type: "resigned" }],
                };

            default:
                return fail(
                    "illegal_action",
                    `Unknown action "${(action as SolitaireAction).type}".`,
                );
        }
    },

    isOver(state) {
        return state.phase !== "playing";
    },

    outcome(state) {
        if (state.phase === "playing") return null;
        const player = state.players[0];
        // A solo game has one ranking either way; what separates a win from a
        // resignation is `winners`. A loss (empty winners) earns participation
        // XP only, and ELO already skips single-human games.
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

/**
 * Build a Solitaire module bound to a rule set. Bound rules (and the redeal
 * counter Vegas needs) are stamped into the state so a saved game replays
 * identically. The unbound module stamps nothing — how games recorded before
 * rules existed were dealt, so their replays still match byte for byte.
 */
export function createSolitaire(
    rules?: SolitaireRules,
): GameModule<SolitaireState, SolitaireAction, SolitaireView> {
    return {
        ...base,
        withRules(chosen) {
            const pick = (key: keyof SolitaireRules): boolean =>
                chosen[key] ?? DEFAULT_SOLITAIRE_RULES[key];
            return createSolitaire({
                drawThree: pick("drawThree"),
                limitedPasses: pick("limitedPasses"),
            });
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
                foundations: {
                    spades: [],
                    hearts: [],
                    diamonds: [],
                    clubs: [],
                },
                tableau,
                moves: 0,
                ...(rules ? { rules, redeals: 0 } : {}),
            };
        },
    };
}

export const solitaire = createSolitaire();
