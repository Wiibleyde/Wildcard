import { french52 } from "@/lib/card/decks";
import { dealRoundRobin, takeCards } from "@/lib/card/hand";
import { buildRankOrder, groupByRank, rankOf } from "@/lib/card/rank";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { cardKey, isCardDescriptor } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
import {
    bindRules,
    defineRules,
    fail,
    seatAfter,
    seatOrder,
} from "@/lib/engine/rules";
import type {
    GameEvent,
    GameModule,
    GameRuleMode,
    GameState,
} from "@/lib/engine/types";

/*
 * Président (Trou du cul) — one round, French rules
 * (https://fr.wikipedia.org/wiki/Trou_du_cul_(jeu)). The engine's turn-based
 * proof: rotating current player, multi-card plays, pass lock-out, and a
 * finishing-order ranking.
 *
 * Base rules: 3 low → 2 high; the Queen of Hearts' holder leads; a response
 * matches the count and climbs; passing locks you out until the trick clears,
 * which happens when play returns to the last player who laid cards.
 *
 * Table rules (PresidentRules), judged under the order in force WHEN laid:
 * - twoClosesTrick — 2s sweep the trick (not under a revolution, where the 2
 *   is the weakest card).
 * - finishOnTwoPenalty — going out on a 2 demotes to last place.
 * - equalRank / equalRankLock (« ou rien ») — matching the rank is legal and
 *   binds only the NEXT player to that rank; a pass or a raise lifts it.
 * - revolution — a quad laid from hand inverts the order for the rest of the
 *   round (another quad flips it back). A quad of 2s under the normal order
 *   both revolts and closes the trick.
 * - quadClosesTrick — completing a carré on the table (via matches) sweeps.
 *
 * Out of scope: the inter-round card exchange (a multi-round meta layer).
 */

/** 3 low → 2 high (also the table's hand order). */
export const RANK_VALUE = buildRankOrder([
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
    "A",
    "2",
]);

export interface PresidentRules {
    readonly twoClosesTrick: boolean;
    readonly finishOnTwoPenalty: boolean;
    readonly equalRank: boolean;
    readonly equalRankLock: boolean;
    readonly revolution: boolean;
    readonly quadClosesTrick: boolean;
}

export const DEFAULT_PRESIDENT_RULES: PresidentRules = {
    twoClosesTrick: true,
    finishOnTwoPenalty: true,
    equalRank: true,
    equalRankLock: true,
    revolution: false,
    quadClosesTrick: true,
};

export const PRESIDENT_RULE_TOGGLES = defineRules(DEFAULT_PRESIDENT_RULES, {
    equalRankLock: "equalRank",
});

const PRESIDENT_RULE_MODES: readonly GameRuleMode[] = [
    { key: "president_fr", rules: {} },
    { key: "president_revolution", rules: { revolution: true } },
    {
        key: "president_simple",
        rules: {
            twoClosesTrick: false,
            finishOnTwoPenalty: false,
            equalRank: false,
            equalRankLock: false,
            revolution: false,
            quadClosesTrick: false,
        },
    },
];

/** A quad: the largest play, and what revolutions and carrés are made of. */
const MAX_PLAY_SIZE = 4;

interface TrickPlay {
    readonly playerId: string;
    readonly cards: readonly CardDescriptor[];
}

interface ComboShape {
    readonly rank: Rank;
    readonly count: number;
}

export interface PresidentState extends GameState {
    readonly phase: "playing" | "done";
    /** Always a seated, in-play player while playing. */
    readonly currentPlayerId: string;
    /** Stamped at deal so any instance replays identically. */
    readonly rules: PresidentRules;
    readonly hands: Readonly<Record<string, readonly CardDescriptor[]>>;
    readonly pile: readonly TrickPlay[];
    /** `null` when the table is open (fresh lead). */
    readonly combo: ComboShape | null;
    readonly revolution: boolean;
    /** « Ou rien » armed for the next player. */
    readonly equalLock: boolean;
    readonly passed: readonly string[];
    /** Index 0 = Président. */
    readonly finished: readonly string[];
    /** Went out on a 2 — ranked below everyone. */
    readonly demoted: readonly string[];
    readonly lastPlayerId: string | null;
    /** The swept trick, kept for display until the next lead so a closing play is seen. */
    readonly lastTrick: readonly TrickPlay[] | null;
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
    /** 1 = Président; `null` while still holding cards. */
    readonly place: number | null;
    readonly demoted: boolean;
    /** Viewer's own slot only. */
    readonly hand?: readonly CardDescriptor[];
}

/** What the trick zone shows: the running trick, or the swept one (`wonBy` set). */
interface PresidentDisplayTrick {
    readonly plays: readonly TrickPlay[];
    readonly wonBy: string | null;
}

export interface PresidentView {
    readonly gameId: string;
    readonly phase: PresidentState["phase"];
    readonly turn: number;
    /** `null` in an optimistic prediction until the server answers. */
    readonly currentPlayerId: string | null;
    readonly rules: PresidentRules;
    readonly combo: ComboShape | null;
    readonly revolution: boolean;
    readonly equalLock: boolean;
    readonly pile: readonly TrickPlay[];
    readonly displayTrick: PresidentDisplayTrick;
    readonly finished: readonly string[];
    readonly players: readonly PresidentPlayerView[];
    readonly self: string | null;
}

function strength(rank: Rank, revolution: boolean): number {
    return revolution ? -RANK_VALUE[rank] : RANK_VALUE[rank];
}

function beatsCombo(
    rank: Rank,
    combo: ComboShape,
    revolution: boolean,
    locked: boolean,
    rules: PresidentRules,
): boolean {
    if (locked) return rank === combo.rank;
    if (strength(rank, revolution) > strength(combo.rank, revolution)) {
        return true;
    }
    return rules.equalRank && rank === combo.rank;
}

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

/** Next seat still in play that has not passed this trick. */
function nextResponder(state: PresidentState, afterId: string): string | null {
    return seatAfter(state.players, afterId, {
        skip: (id) => isOut(state, id) || state.passed.includes(id),
    });
}

/** Round over (≤ 1 player still holding cards) ⇒ final state, else `null`. */
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

/** Sweep; the lead goes to `preferredLeader`, or the next seat in play if they just went out. */
function clearTrick(
    state: PresidentState,
    preferredLeader: string,
): PresidentState {
    const leader = !isOut(state, preferredLeader)
        ? preferredLeader
        : (seatAfter(state.players, preferredLeader, {
              skip: (id) => isOut(state, id),
          }) ?? preferredLeader);
    return {
        ...state,
        pile: [],
        lastTrick: state.pile,
        combo: null,
        // `revolution` deliberately survives: it lasts the whole round.
        equalLock: false,
        passed: [],
        currentPlayerId: leader,
    };
}

/** After `actorId` acted: end the round, pass the turn on, or sweep to the top player. */
function settle(state: PresidentState, actorId: string): PresidentState {
    const ended = endIfDecided(state, actorId);
    if (ended) return ended;

    const next = nextResponder(state, actorId);
    const top = state.lastPlayerId;
    if (next === null || next === top) {
        return clearTrick(state, top ?? actorId);
    }
    return { ...state, currentPlayerId: next };
}

/** Did this play complete four of `rank` across the consecutive plays on the table? */
function completesCarre(pile: readonly TrickPlay[], rank: Rank): boolean {
    let laid = 0;
    for (let i = pile.length - 1; i >= 0; i--) {
        if (comboRank(pile[i].cards) !== rank) break;
        laid += pile[i].cards.length;
    }
    return laid === MAX_PLAY_SIZE;
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
    ruleToggles: PRESIDENT_RULE_TOGGLES,
    ruleModes: PRESIDENT_RULE_MODES,

    legalActions(state, playerId) {
        if (state.phase === "done") return [];
        if (playerId !== state.currentPlayerId) return [];
        if (isOut(state, playerId)) return [];

        const groups = groupByRank(state.hands[playerId]);
        const actions: PresidentAction[] = [];

        if (state.combo === null) {
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
            for (const [rank, cards] of groups) {
                if (
                    cards.length >= need &&
                    beatsCombo(
                        rank,
                        state.combo,
                        state.revolution,
                        state.equalLock,
                        state.rules,
                    )
                ) {
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

    apply(state, action) {
        if (action.type !== "play" && action.type !== "pass") {
            return fail("invalid_action", "Malformed action.");
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
                    // « Ou rien » binds only the next player: a pass breaks it.
                    equalLock: false,
                },
                action.playerId,
            );
            const events: GameEvent[] = [
                { type: "passed", payload: { playerId: action.playerId } },
            ];
            if (advanced.combo === null) {
                events.push({
                    type: "trick_cleared",
                    payload: { leadPlayerId: advanced.currentPlayerId },
                });
            }
            return { ok: true, state: advanced, events };
        }

        const requested: unknown = action.cards;
        if (!Array.isArray(requested)) {
            return fail("invalid_action", "`cards` must be an array.");
        }
        if (requested.length === 0) {
            return fail("empty_play", "Must play at least one card.");
        }
        if (requested.length > MAX_PLAY_SIZE) {
            return fail(
                "invalid_action",
                `A play holds at most ${MAX_PLAY_SIZE} cards.`,
            );
        }
        if (!requested.every(isCardDescriptor)) {
            return fail("illegal_card", "Malformed card descriptor.");
        }

        const held = takeCards(state.hands[action.playerId], requested);
        if (held === null) {
            return fail("not_in_hand", "Played a card not held in hand.");
        }
        const { taken: cards, remaining } = held;
        const rank = comboRank(cards);
        if (rank === null) {
            return fail("mixed_ranks", "All cards must share a single rank.");
        }

        if (state.combo) {
            if (cards.length !== state.combo.count) {
                return fail(
                    "wrong_count",
                    `Must play exactly ${state.combo.count} card(s).`,
                );
            }
            if (
                !beatsCombo(
                    rank,
                    state.combo,
                    state.revolution,
                    state.equalLock,
                    state.rules,
                )
            ) {
                return fail("too_low", "Combo does not beat the table.");
            }
        }

        const wentOut = remaining.length === 0;
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

        const isQuad = cards.length === MAX_PLAY_SIZE;
        // `state.revolution` (the order when laid) still judges THIS play.
        const revolution =
            state.rules.revolution && isQuad
                ? !state.revolution
                : state.revolution;
        if (revolution !== state.revolution) {
            events.push({
                type: "revolution",
                payload: { active: revolution },
            });
        }

        // A match arms the lock for the next player; a locked player can only
        // match, so a run of matches re-arms it and can still complete a carré.
        const equalMatch = state.combo !== null && rank === state.combo.rank;
        const equalLock = state.rules.equalRankLock && equalMatch;

        const played: PresidentState = {
            ...state,
            hands: { ...state.hands, [action.playerId]: remaining },
            finished,
            demoted,
            pile: [...state.pile, { playerId: action.playerId, cards }],
            lastTrick: null,
            combo: { rank, count: cards.length },
            revolution,
            equalLock,
            lastPlayerId: action.playerId,
        };

        // A quad laid from hand under the revolution rule is a revolution,
        // not a completed carré: it stays open to a counter-revolution.
        const quadCompleted =
            state.rules.quadClosesTrick &&
            !(state.rules.revolution && isQuad) &&
            completesCarre(played.pile, rank);

        if (equalLock && !state.equalLock && !quadCompleted) {
            events.push({
                type: "or_nothing",
                payload: { playerId: action.playerId, rank },
            });
        }

        const closesTrick =
            quadCompleted ||
            (state.rules.twoClosesTrick && rank === "2" && !state.revolution);
        const advanced = closesTrick
            ? (endIfDecided(played, action.playerId) ??
              clearTrick(played, action.playerId))
            : settle(played, action.playerId);

        if (advanced.phase === "done") {
            events.push({ type: "game_over" });
        } else if (advanced.combo === null) {
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

        // Clean finishers, then whoever still holds cards (seat order), then
        // the demoted — each later offender took the bottom spot.
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
        const swept =
            state.pile.length === 0 && (state.lastTrick?.length ?? 0) > 0;
        const plays = swept ? (state.lastTrick ?? []) : state.pile;

        return {
            gameId: state.gameId,
            phase: state.phase,
            turn: state.turn,
            currentPlayerId: state.currentPlayerId,
            rules: state.rules,
            combo: state.combo,
            revolution: state.revolution,
            equalLock: state.equalLock,
            pile: state.pile,
            displayTrick: {
                plays,
                wonBy: swept ? (plays.at(-1)?.playerId ?? null) : null,
            },
            finished: state.finished,
            self: viewerId,
            players: seatOrder(state.players).map((p): PresidentPlayerView => {
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

function createPresident(
    rules: PresidentRules = DEFAULT_PRESIDENT_RULES,
): GameModule<PresidentState, PresidentAction, PresidentView> {
    return {
        ...base,
        withRules(chosen) {
            return createPresident(bindRules(chosen, DEFAULT_PRESIDENT_RULES));
        },
        setup(players, rng, seed, gameId) {
            const order = seatOrder(players);
            const deck = rng.shuffle(buildDeck(french52));
            const dealt = dealRoundRobin(deck, order.length);
            const hands: Record<string, readonly CardDescriptor[]> = {};
            order.forEach((p, i) => {
                hands[p.id] = dealt[i];
            });

            // « La dame de cœur commence ».
            const leadKey = cardKey({
                type: "suited",
                suit: "hearts",
                rank: "Q",
            });
            const leader =
                order.find((p) =>
                    hands[p.id].some((c) => cardKey(c) === leadKey),
                )?.id ?? order[0].id;

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
                revolution: false,
                equalLock: false,
                passed: [],
                finished: [],
                demoted: [],
                lastPlayerId: null,
                lastTrick: null,
            };
        },
    };
}

export const president = createPresident();
