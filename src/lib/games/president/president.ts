import { french52 } from "@/lib/card/decks";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
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
 * Base rules (always on):
 * - Ranking 3 (low) → 2 (high); 2 beats the Ace.
 * - A play is N cards of one rank; responses must match the count and be
 *   strictly higher.
 * - Passing locks you out until the trick clears; the trick clears when the
 *   turn returns to the last player who laid cards, who then leads anew.
 * - Going out ranks you: 1st = Président … last (still holding cards) = Trou
 *   du cul.
 *
 * French table rules — configurable via {@link PresidentRules}, all enabled
 * by default; see {@link createPresident}:
 * - `twoClosesTrick` — « le 2 ferme le pli » : playing 2s wins the trick on
 *   the spot (count must still match); the table sweeps and the same player
 *   leads again.
 * - `finishOnTwoPenalty` — « finir par un 2 » : going out on a 2 demotes the
 *   player to last place (each new offender takes the bottom spot).
 *
 * The chosen rules are stamped into the state at setup and read back by
 * `apply`, so ANY module instance can resume or replay a saved game —
 * persist `state.rules` alongside the seed and the action log.
 *
 * Still out of scope by design: equal-rank skip, revolution (4-of-a-kind),
 * and the inter-round card exchange (a meta layer above single rounds).
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

/** Optional French table rules — see the module doc for what each enables. */
export interface PresidentRules {
    /** « Le 2 ferme le pli » — playing 2s sweeps the trick immediately. */
    readonly twoClosesTrick: boolean;
    /** « Finir par un 2 » — going out on a 2 demotes you to last place. */
    readonly finishOnTwoPenalty: boolean;
}

export const DEFAULT_PRESIDENT_RULES: PresidentRules = {
    twoClosesTrick: true,
    finishOnTwoPenalty: true,
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
    /** Table rules this game was created with — drives `apply`. */
    readonly rules: PresidentRules;
    readonly hands: Readonly<Record<string, readonly CardDescriptor[]>>;
    /** Cards laid in the current (uncleared) trick — public. */
    readonly pile: readonly TrickPlay[];
    /** Shape to beat; `null` when the table is open (a fresh lead). */
    readonly combo: ComboShape | null;
    /** Players who passed this trick (locked out until it clears). */
    readonly passed: readonly string[];
    /** Finishing order; index 0 = Président. */
    readonly finished: readonly string[];
    /** Players demoted for going out on a 2 — ranked below everyone else. */
    readonly demoted: readonly string[];
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
    /** Set once the player goes out cleanly; 1 = Président. */
    readonly place: number | null;
    /** True when the player went out on a 2 and awaits the bottom rank. */
    readonly demoted: boolean;
    /** Own cards — present only in the viewer's own slot. */
    readonly hand?: readonly CardDescriptor[];
}

export interface PresidentView {
    readonly gameId: string;
    readonly phase: PresidentState["phase"];
    readonly turn: number;
    readonly currentPlayerId: string;
    readonly rules: PresidentRules;
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

/** Out of the round — went out cleanly (ranked) or was demoted on a 2. */
function isOut(state: PresidentState, id: string): boolean {
    return state.finished.includes(id) || state.demoted.includes(id);
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
            !isOut(state, candidate.id) &&
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
        if (!isOut(state, candidate.id)) return candidate.id;
    }
    return null;
}

/** Round over (≤1 player still holding cards) ⇒ final state, else `null`. */
function endIfDecided(
    state: PresidentState,
    fallbackId: string,
): PresidentState | null {
    const remaining = state.players.filter((p) => !isOut(state, p.id));
    if (remaining.length > 1) return null;
    return {
        ...state,
        phase: "done",
        currentPlayerId: remaining[0]?.id ?? fallbackId,
    };
}

/** Sweep the table and hand the lead to `preferredLeader` (or the next seat
 * still in play when that player just went out). */
function clearTrick(
    state: PresidentState,
    preferredLeader: string,
): PresidentState {
    const leader = !isOut(state, preferredLeader)
        ? preferredLeader
        : (nextInPlay(state, preferredLeader) ?? preferredLeader);
    return {
        ...state,
        pile: [],
        combo: null,
        passed: [],
        currentPlayerId: leader,
    };
}

/**
 * Advance the turn after `actorId` acted: end the game if one player is left,
 * otherwise either pass the turn on or clear the trick and hand the lead to the
 * last player who laid cards.
 */
function settle(state: PresidentState, actorId: string): PresidentState {
    const ended = endIfDecided(state, actorId);
    if (ended) return ended;

    const next = nextResponder(state, actorId);
    const top = state.lastPlayerId;

    // Trick clears when the turn comes back to the top player (everyone else
    // passed or finished) or no one can respond.
    if (next === null || next === top) {
        return clearTrick(state, top ?? actorId);
    }

    return { ...state, currentPlayerId: next };
}

function fail(code: string, message: string): ApplyResult<PresidentState> {
    return { ok: false, error: { code, message } };
}

const base: Omit<
    GameModule<PresidentState, PresidentAction, PresidentView>,
    "setup"
> = {
    id: "president",
    name: "Président",
    deck: french52,
    minPlayers: 3,
    maxPlayers: 6,

    legalActions(state, playerId) {
        if (state.phase === "done") return [];
        if (playerId !== state.currentPlayerId) return [];
        if (isOut(state, playerId)) return [];

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
        if (isOut(state, action.playerId)) {
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
            const events: GameEvent[] = [
                { type: "passed", payload: { playerId: action.playerId } },
            ];
            // combo was non-null (pass requires a live trick) — null ⇒ swept.
            if (advanced.combo === null) {
                events.push({
                    type: "trick_cleared",
                    payload: { leadPlayerId: advanced.currentPlayerId },
                });
            }
            return { ok: true, state: advanced, events };
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

        const wentOut = remaining.length === 0;
        // « Finir par un 2 » — going out on a 2 demotes instead of ranking.
        const demotedNow =
            wentOut && state.rules.finishOnTwoPenalty && rank === "2";
        const finished =
            wentOut && !demotedNow
                ? [...state.finished, action.playerId]
                : state.finished;
        const demoted = demotedNow
            ? [...state.demoted, action.playerId]
            : state.demoted;

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
        if (demotedNow) {
            events.push({
                type: "demoted",
                payload: { playerId: action.playerId },
            });
        } else if (wentOut) {
            events.push({
                type: "finished",
                payload: { playerId: action.playerId, place: finished.length },
            });
        }

        const played: PresidentState = {
            ...state,
            hands: { ...state.hands, [action.playerId]: remaining },
            finished,
            demoted,
            pile: [...state.pile, { playerId: action.playerId, cards }],
            combo: { rank, count: cards.length },
            lastPlayerId: action.playerId,
            turn: state.turn + 1,
        };

        // « Le 2 ferme le pli » — the table sweeps and the actor leads again.
        const closesTrick = state.rules.twoClosesTrick && rank === "2";
        const advanced = closesTrick
            ? (endIfDecided(played, action.playerId) ??
              clearTrick(played, action.playerId))
            : settle(played, action.playerId);

        if (advanced.phase === "done") {
            events.push({ type: "game_over" });
        } else if (advanced.combo === null) {
            // The play set a combo and it is gone ⇒ the trick was swept.
            events.push({
                type: "trick_cleared",
                payload: { leadPlayerId: advanced.currentPlayerId },
            });
        }
        return { ok: true, state: advanced, events };
    },

    isOver(state) {
        return state.phase === "done";
    },

    outcome(state) {
        if (state.phase !== "done") return null;

        // Clean finishers first, then whoever still holds cards (seat order),
        // then the demoted — each successive offender took the bottom spot.
        const ranked = [...state.finished];
        for (const p of seatOrder(state.players)) {
            if (!ranked.includes(p.id) && !state.demoted.includes(p.id)) {
                ranked.push(p.id);
            }
        }
        ranked.push(...state.demoted);

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
            rules: state.rules,
            combo: state.combo,
            pile: state.pile,
            finished: state.finished,
            self: viewerId,
            players: state.players.map((p): PresidentPlayerView => {
                const slot: PresidentPlayerView = {
                    playerId: p.id,
                    name: p.name,
                    handCount: state.hands[p.id].length,
                    passed: state.passed.includes(p.id),
                    place: placeOf(p.id),
                    demoted: state.demoted.includes(p.id),
                };
                return viewerId === p.id
                    ? { ...slot, hand: state.hands[p.id] }
                    : slot;
            }),
        };
    },
};

/**
 * Build a Président module for a given table-rule configuration. The rules
 * are stamped into the state, so a saved game resumes/replays identically on
 * any instance — pair the persisted `state.rules` with the seed + action log.
 */
export function createPresident(
    rules: PresidentRules = DEFAULT_PRESIDENT_RULES,
): GameModule<PresidentState, PresidentAction, PresidentView> {
    return {
        ...base,
        setup(players, rng, seed, gameId) {
            const order = seatOrder(players);
            const deck = rng.shuffle(buildDeck(french52));
            const hands: Record<string, CardDescriptor[]> = {};
            for (const p of order) hands[p.id] = [];
            deck.forEach((card, i) => {
                hands[order[i % order.length].id].push(card);
            });

            // Holder of the 3 of clubs leads the first trick.
            const leadKey = cardKey({
                type: "suited",
                suit: "clubs",
                rank: "3",
            });
            let leader = order[0].id;
            for (const p of order) {
                if (hands[p.id].some((c) => cardKey(c) === leadKey)) {
                    leader = p.id;
                    break;
                }
            }

            return {
                gameId,
                players,
                phase: "playing",
                currentPlayerId: leader,
                turn: 0,
                seed,
                rngState: rng.state,
                rules,
                hands,
                pile: [],
                combo: null,
                passed: [],
                finished: [],
                demoted: [],
                lastPlayerId: null,
            };
        },
    };
}

/** Default module — French table rules enabled. */
export const president = createPresident();
