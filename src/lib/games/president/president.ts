import { french52 } from "@/lib/card/decks";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { buildDeck, cardKey } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    GameState,
    Player,
} from "@/lib/engine/types";

/**
 * Président (Trou du cul) — one round of the climbing/shedding game.
 *
 * This is the engine's *turn-based* proof: a rotating `currentPlayerId`, a
 * multi-card action union (`play` N same-rank cards / `pass`), pass-lockout
 * tricks, and a finishing-order ranking. It complements Bataille, which proved
 * the simultaneous/engine-driven path.
 *
 * Base rules modelled here:
 * - Ranking 3 (low) → 2 (high); 2 beats the Ace.
 * - A play is N cards of one rank; responses must match the count and be
 *   strictly higher. No bombs / equal-rank skips (kept out of the base set).
 * - Passing locks you out until the trick clears; the trick clears when the
 *   turn returns to the last player who laid cards, who then leads anew.
 * - Going out ranks you: 1st = Président … last (still holding cards) = Trou du
 *   cul. Inter-round card exchange is a separate meta layer, not modelled here.
 */

/** Président ranking: 3 lowest → 2 highest. `C` (unused in french52) sits high.
 * Intentionally different from bataille.ts: 2 beats Ace here (Président rule). */
const RANK_VALUE: Record<Rank, number> = {
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    C: 12,
    Q: 13,
    K: 14,
    A: 15,
    "2": 16,
};

export interface TrickPlay {
    readonly playerId: string;
    readonly cards: readonly CardDescriptor[];
}

/** Shape the table currently demands: `count` cards of rank `rank`. */
export interface ComboShape {
    readonly rank: Rank;
    readonly count: number;
}

export interface PresidentState extends GameState {
    readonly phase: "playing" | "done";
    /** Always a seated, in-play player while `phase === "playing"`. */
    readonly currentPlayerId: string;
    readonly hands: Readonly<Record<string, readonly CardDescriptor[]>>;
    /** Cards laid in the current (uncleared) trick — public. */
    readonly pile: readonly TrickPlay[];
    /** Shape to beat; `null` when the table is open (a fresh lead). */
    readonly combo: ComboShape | null;
    /** Players who passed this trick (locked out until it clears). */
    readonly passed: readonly string[];
    /** Finishing order; index 0 = Président. */
    readonly finished: readonly string[];
    /** Last player to lay the top combo — leads once the trick clears. */
    readonly lastPlayerId: string | null;
}

export type PresidentAction =
    | {
          readonly type: "play";
          readonly playerId: string;
          readonly cards: readonly CardDescriptor[];
      }
    | { readonly type: "pass"; readonly playerId: string };

export interface PresidentPlayerView {
    readonly playerId: string;
    readonly name: string;
    readonly handCount: number;
    readonly passed: boolean;
    /** Set once the player goes out; 1 = Président. */
    readonly place: number | null;
    /** Own cards — present only in the viewer's own slot. */
    readonly hand?: readonly CardDescriptor[];
}

export interface PresidentView {
    readonly gameId: string;
    readonly phase: PresidentState["phase"];
    readonly turn: number;
    readonly currentPlayerId: string;
    readonly combo: ComboShape | null;
    readonly pile: readonly TrickPlay[];
    readonly finished: readonly string[];
    readonly players: readonly PresidentPlayerView[];
    /** The viewer this projection was built for (`null` = spectator). */
    readonly self: string | null;
}

function rankOf(card: CardDescriptor): Rank | null {
    return card.type === "suited" ? card.rank : null;
}

function seatOrder(players: readonly Player[]): Player[] {
    return [...players].sort((a, b) => a.seat - b.seat);
}

function isFinished(state: PresidentState, id: string): boolean {
    return state.finished.includes(id);
}

/** The single rank shared by `cards`, or `null` if mixed/empty/non-suited. */
function comboRank(cards: readonly CardDescriptor[]): Rank | null {
    if (cards.length === 0) return null;
    const first = rankOf(cards[0]);
    if (first === null) return null;
    for (const card of cards) {
        if (rankOf(card) !== first) return null;
    }
    return first;
}

/** Remove one occurrence of each card from `hand`, or `null` if any is absent. */
function removeCards(
    hand: readonly CardDescriptor[],
    cards: readonly CardDescriptor[],
): readonly CardDescriptor[] | null {
    const remaining = [...hand];
    for (const card of cards) {
        const key = cardKey(card);
        const index = remaining.findIndex((c) => cardKey(c) === key);
        if (index === -1) return null;
        remaining.splice(index, 1);
    }
    return remaining;
}

/** Next seat after `afterId` that may still act this trick (in play, not passed). */
function nextResponder(state: PresidentState, afterId: string): string | null {
    const order = seatOrder(state.players);
    const start = order.findIndex((p) => p.id === afterId);
    for (let k = 1; k <= order.length; k++) {
        const candidate = order[(start + k) % order.length];
        if (
            !isFinished(state, candidate.id) &&
            !state.passed.includes(candidate.id)
        ) {
            return candidate.id;
        }
    }
    return null;
}

/** Next seat after `afterId` that is still in play (ignores passes). */
function nextInPlay(state: PresidentState, afterId: string): string | null {
    const order = seatOrder(state.players);
    const start = order.findIndex((p) => p.id === afterId);
    for (let k = 1; k <= order.length; k++) {
        const candidate = order[(start + k) % order.length];
        if (!isFinished(state, candidate.id)) return candidate.id;
    }
    return null;
}

/**
 * Advance the turn after `actorId` acted: end the game if one player is left,
 * otherwise either pass the turn on or clear the trick and hand the lead to the
 * last player who laid cards.
 */
function settle(state: PresidentState, actorId: string): PresidentState {
    const remaining = state.players.filter((p) => !isFinished(state, p.id));

    // One player left holding cards ⇒ they are the Trou du cul; round over.
    if (remaining.length <= 1) {
        return {
            ...state,
            phase: "done",
            currentPlayerId: remaining[0]?.id ?? actorId,
        };
    }

    const next = nextResponder(state, actorId);
    const top = state.lastPlayerId;

    // Trick clears when the turn comes back to the top player (everyone else
    // passed or finished) or no one can respond.
    if (next === null || next === top) {
        const leader =
            top && !isFinished(state, top)
                ? top
                : (nextInPlay(state, top ?? actorId) ?? actorId);
        return {
            ...state,
            pile: [],
            combo: null,
            passed: [],
            currentPlayerId: leader,
        };
    }

    return { ...state, currentPlayerId: next };
}

function fail(code: string, message: string): ApplyResult<PresidentState> {
    return { ok: false, error: { code, message } };
}

export const president: GameModule<
    PresidentState,
    PresidentAction,
    PresidentView
> = {
    id: "president",
    name: "Président",
    deck: french52,
    minPlayers: 3,
    maxPlayers: 6,

    setup(players, rng, seed) {
        const order = seatOrder(players);
        const deck = rng.shuffle(buildDeck(french52));
        const hands: Record<string, CardDescriptor[]> = {};
        for (const p of order) hands[p.id] = [];
        deck.forEach((card, i) => {
            hands[order[i % order.length].id].push(card);
        });

        // Holder of the 3 of clubs leads the first trick.
        const leadKey = cardKey({ type: "suited", suit: "clubs", rank: "3" });
        let leader = order[0].id;
        for (const p of order) {
            if (hands[p.id].some((c) => cardKey(c) === leadKey)) {
                leader = p.id;
                break;
            }
        }

        return {
            gameId: crypto.randomUUID(),
            players,
            phase: "playing",
            currentPlayerId: leader,
            turn: 0,
            seed,
            rngState: rng.state,
            hands,
            pile: [],
            combo: null,
            passed: [],
            finished: [],
            lastPlayerId: null,
        };
    },

    legalActions(state, playerId) {
        if (state.phase === "done") return [];
        if (playerId !== state.currentPlayerId) return [];
        if (isFinished(state, playerId)) return [];

        const hand = state.hands[playerId];
        const groups = new Map<Rank, CardDescriptor[]>();
        for (const card of hand) {
            const rank = rankOf(card);
            if (rank === null) continue;
            const group = groups.get(rank) ?? [];
            group.push(card);
            groups.set(rank, group);
        }

        const actions: PresidentAction[] = [];

        if (state.combo === null) {
            // Leading: any count of any single rank.
            for (const cards of groups.values()) {
                for (let n = 1; n <= cards.length; n++) {
                    actions.push({
                        type: "play",
                        playerId,
                        cards: cards.slice(0, n),
                    });
                }
            }
        } else {
            const need = state.combo.count;
            const floor = RANK_VALUE[state.combo.rank];
            for (const [rank, cards] of groups) {
                if (cards.length >= need && RANK_VALUE[rank] > floor) {
                    actions.push({
                        type: "play",
                        playerId,
                        cards: cards.slice(0, need),
                    });
                }
            }
            actions.push({ type: "pass", playerId });
        }

        return actions;
    },

    apply(state, action, _rng: Rng) {
        if (state.phase === "done") {
            return fail("game_over", "The round has already finished.");
        }
        if (action.playerId !== state.currentPlayerId) {
            return fail("not_your_turn", "It is not this player's turn.");
        }
        if (isFinished(state, action.playerId)) {
            return fail("already_finished", "This player is already out.");
        }

        if (action.type === "pass") {
            if (state.combo === null) {
                return fail("cannot_pass_lead", "The lead player must play.");
            }
            const advanced = settle(
                {
                    ...state,
                    passed: [...state.passed, action.playerId],
                    turn: state.turn + 1,
                },
                action.playerId,
            );
            return {
                ok: true,
                state: advanced,
                events: [
                    { type: "passed", payload: { playerId: action.playerId } },
                ],
            };
        }

        const { cards } = action;
        if (cards.length === 0) {
            return fail("empty_play", "Must play at least one card.");
        }
        const rank = comboRank(cards);
        if (rank === null) {
            return fail("mixed_ranks", "All cards must share a single rank.");
        }

        const remaining = removeCards(state.hands[action.playerId], cards);
        if (remaining === null) {
            return fail("not_in_hand", "Played a card not held in hand.");
        }

        if (state.combo) {
            if (cards.length !== state.combo.count) {
                return fail(
                    "wrong_count",
                    `Must play exactly ${state.combo.count} card(s).`,
                );
            }
            if (RANK_VALUE[rank] <= RANK_VALUE[state.combo.rank]) {
                return fail("too_low", "Combo does not beat the table.");
            }
        }

        const finished =
            remaining.length === 0
                ? [...state.finished, action.playerId]
                : state.finished;

        const events: GameEvent[] = [
            {
                type: "played",
                payload: {
                    playerId: action.playerId,
                    rank,
                    count: cards.length,
                },
            },
        ];
        if (remaining.length === 0) {
            events.push({
                type: "finished",
                payload: { playerId: action.playerId, place: finished.length },
            });
        }

        const advanced = settle(
            {
                ...state,
                hands: { ...state.hands, [action.playerId]: remaining },
                finished,
                pile: [...state.pile, { playerId: action.playerId, cards }],
                combo: { rank, count: cards.length },
                lastPlayerId: action.playerId,
                turn: state.turn + 1,
            },
            action.playerId,
        );

        if (advanced.phase === "done") {
            events.push({ type: "game_over" });
        }
        return { ok: true, state: advanced, events };
    },

    isOver(state) {
        return state.phase === "done";
    },

    outcome(state) {
        if (state.phase !== "done") return null;

        const ranked = [...state.finished];
        for (const p of seatOrder(state.players)) {
            if (!ranked.includes(p.id)) ranked.push(p.id);
        }
        const rankings = ranked.map((playerId, index) => ({
            playerId,
            rank: index + 1,
        }));
        return { rankings, winners: ranked.length > 0 ? [ranked[0]] : [] };
    },

    view(state, viewerId) {
        const placeOf = (id: string): number | null => {
            const index = state.finished.indexOf(id);
            return index === -1 ? null : index + 1;
        };

        return {
            gameId: state.gameId,
            phase: state.phase,
            turn: state.turn,
            currentPlayerId: state.currentPlayerId,
            combo: state.combo,
            pile: state.pile,
            finished: state.finished,
            self: viewerId,
            players: state.players.map((p): PresidentPlayerView => {
                const base: PresidentPlayerView = {
                    playerId: p.id,
                    name: p.name,
                    handCount: state.hands[p.id].length,
                    passed: state.passed.includes(p.id),
                    place: placeOf(p.id),
                };
                return viewerId === p.id
                    ? { ...base, hand: state.hands[p.id] }
                    : base;
            }),
        };
    },
};
