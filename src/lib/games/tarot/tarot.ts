import { tarot78 } from "@/lib/card/decks";
import { dealRoundRobin, takeCards } from "@/lib/card/hand";
import { buildRankOrder } from "@/lib/card/rank";
import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey, isCardDescriptor } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import {
    bindRules,
    defineRules,
    fail,
    rankByScore,
    rotateFrom,
    seatAfter,
    seatOrder,
} from "@/lib/engine/rules";
import type {
    GameEvent,
    GameModule,
    GameRuleMode,
    GameState,
    Player,
} from "@/lib/engine/types";
import {
    BID_RANK,
    type Bid,
    type CompletedTrick,
    DEFAULT_TAROT_RULES,
    type DealResult,
    type DeclaredHandful,
    HANDFUL_LEVELS,
    type HandfulLevel,
    handfulSize,
    isBout,
    scoreDeal,
    type TarotRules,
    type TrickCard,
} from "./scoring";

/*
 * Tarot français (3–4 players) — the engine's multi-phase proof:
 *
 *   bidding ─▶ dog (chien / écart) ─▶ slam ─▶ playing ─▶ done
 *
 * Bidding is one round of strict overcalls; Petite/Garde take the chien and
 * bury six (never Kings or bouts, trumps only when forced); the FFT announced
 * slam gives the taker the lead; play follows suit, trumps and over-trumps.
 * Poignées are shown just before a player's first card. Scoring lives in
 * `scoring.ts`. Out of scope: the 5-player « roi appelé ».
 * Source: Fédération Française de Tarot, « Règlement officiel ».
 */

/** Within a suit: A low → K high (K > Q > C > J > 10 …). */
export const SUIT_STRENGTH = buildRankOrder([
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
    "C",
    "Q",
    "K",
]);

const ALL_BIDS: readonly Bid[] = [
    "petite",
    "garde",
    "garde-sans",
    "garde-contre",
];

const CHIEN_SIZE = 6;
const ECART_SIZE = 6;

type TarotPhase = "bidding" | "dog" | "slam" | "playing" | "done";

export interface TarotState extends GameState {
    readonly phase: TarotPhase;
    /** A seated player while running; the taker at `done`. */
    readonly currentPlayerId: string;
    readonly rules: TarotRules;
    /** Opens the bidding and leads trick one; moves one seat on each redeal. */
    readonly eldestId: string;
    readonly hands: Readonly<Record<string, readonly CardDescriptor[]>>;

    readonly bids: Readonly<Record<string, Bid | "pass">>;
    readonly taker: string | null;
    readonly contract: Bid | null;
    /** All-pass redeals so far, each reshuffled from the seeded RNG. */
    readonly redeals: number;

    readonly chien: readonly CardDescriptor[];
    /** Secret to everyone but the taker. */
    readonly ecart: readonly CardDescriptor[];

    readonly pile: readonly TrickCard[];
    readonly trickLeaderId: string | null;
    readonly tricks: readonly CompletedTrick[];
    /** Kept on the table until the next lead. */
    readonly lastTrick: CompletedTrick | null;
    /** Absent until the first one is shown (and on legacy deals). */
    readonly handfuls?: Readonly<Record<string, DeclaredHandful>>;
    /** Absent unless announced. */
    readonly slamAnnounced?: boolean;

    readonly result: DealResult | null;
}

export type TarotAction =
    | { readonly type: "bid"; readonly playerId: string; readonly bid: Bid }
    /** Bidding pass, or declining the slam. */
    | { readonly type: "pass"; readonly playerId: string }
    | {
          readonly type: "discard";
          readonly playerId: string;
          readonly card: CardDescriptor;
      }
    | {
          readonly type: "play";
          readonly playerId: string;
          readonly card: CardDescriptor;
      }
    /** Omitted `cards`: the server shows the strongest trumps for the level. */
    | {
          readonly type: "handful";
          readonly playerId: string;
          readonly level: HandfulLevel;
          readonly cards?: readonly CardDescriptor[];
      }
    | { readonly type: "announceSlam"; readonly playerId: string };

export interface TarotPlayerView {
    readonly playerId: string;
    readonly name: string;
    readonly handCount: number;
    readonly isTaker: boolean;
    /** Public once spoken (`null` until then); kept for the rest of the deal. */
    readonly bid: Bid | "pass" | null;
    readonly trickWins: number;
    readonly handful: DeclaredHandful | null;
    /** Viewer's own slot only. */
    readonly hand?: readonly CardDescriptor[];
}

/** What the trick zone shows: the running trick, or the won one (`wonBy` set). */
interface TarotDisplayTrick {
    readonly plays: readonly TrickCard[];
    readonly wonBy: string | null;
}

export interface TarotView {
    readonly gameId: string;
    readonly phase: TarotPhase;
    readonly turn: number;
    /** `null` in an optimistic prediction until the server answers. */
    readonly currentPlayerId: string | null;
    readonly rules: TarotRules;
    readonly taker: string | null;
    readonly contract: Bid | null;
    readonly redeals: number;
    readonly highestBid: Bid | null;
    /** Revealed during the dog phase and at game end; else `[]`. */
    readonly chien: readonly CardDescriptor[];
    readonly chienRevealed: boolean;
    readonly ecartCount: number;
    readonly pile: readonly TrickCard[];
    readonly trickLeaderId: string | null;
    readonly displayTrick: TarotDisplayTrick;
    readonly result: DealResult | null;
    readonly slamAnnounced: boolean;
    readonly players: readonly TarotPlayerView[];
    readonly self: string | null;
}

function isTrump(
    c: CardDescriptor,
): c is Extract<CardDescriptor, { type: "trump" }> {
    return c.type === "trump";
}

function isKing(c: CardDescriptor): boolean {
    return c.type === "suited" && c.rank === "K";
}

function topTrump(pile: readonly TrickCard[]): number {
    return pile.reduce(
        (max, p) => (isTrump(p.card) ? Math.max(max, p.card.index) : max),
        0,
    );
}

type TrickDemand =
    | { readonly kind: "free" }
    | { readonly kind: "suit"; readonly suit: Suit }
    | { readonly kind: "trump" };

/** Set by the first non-Excuse card: a pile holding only the Excuse is still free. */
function trickDemand(pile: readonly TrickCard[]): TrickDemand {
    const lead = pile.find((p) => p.card.type !== "fool");
    if (!lead) return { kind: "free" };
    if (lead.card.type === "trump") return { kind: "trump" };
    if (lead.card.type === "suited") {
        return { kind: "suit", suit: lead.card.suit };
    }
    return { kind: "free" };
}

/** Follow suit; if void, trump and over-trump when able; the Excuse is always playable. */
export function legalCards(
    hand: readonly CardDescriptor[],
    pile: readonly TrickCard[],
): CardDescriptor[] {
    const demand = trickDemand(pile);
    if (demand.kind === "free") return [...hand];

    const fool = hand.filter((c) => c.type === "fool");
    const trumps = hand.filter(isTrump);
    const high = topTrump(pile);
    const overTrumps = trumps.filter((c) => c.index > high);
    const mustTrump = overTrumps.length > 0 ? overTrumps : trumps;

    if (demand.kind === "suit") {
        const suited = hand.filter(
            (c) => c.type === "suited" && c.suit === demand.suit,
        );
        if (suited.length > 0) return [...suited, ...fool];
    }
    if (trumps.length > 0) return [...mustTrump, ...fool];
    return [...hand];
}

interface TrickContext {
    readonly isLastTrick: boolean;
    /** The side of the trick's leader won every previous trick. */
    readonly leaderSideWonAll: boolean;
}

/**
 * Highest trump, else highest card of the led suit. The Excuse never wins —
 * except led to the last trick by a side that won all the others (FFT), so
 * playing it last never breaks a slam.
 */
export function trickWinner(
    plays: readonly TrickCard[],
    context?: TrickContext,
): string {
    const opener = plays[0];
    if (
        opener?.card.type === "fool" &&
        context?.isLastTrick &&
        context.leaderSideWonAll
    ) {
        return opener.playerId;
    }

    let bestTrump: { playerId: string; index: number } | null = null;
    for (const p of plays) {
        if (isTrump(p.card) && (!bestTrump || p.card.index > bestTrump.index)) {
            bestTrump = { playerId: p.playerId, index: p.card.index };
        }
    }
    if (bestTrump) return bestTrump.playerId;

    const lead = plays.find((p) => p.card.type !== "fool");
    if (lead?.card.type !== "suited") {
        return (lead ?? plays[0]).playerId;
    }
    const suit = lead.card.suit;
    let best = { playerId: lead.playerId, strength: 0 };
    for (const p of plays) {
        if (p.card.type !== "suited" || p.card.suit !== suit) continue;
        const strength = SUIT_STRENGTH[p.card.rank];
        if (strength > best.strength) {
            best = { playerId: p.playerId, strength };
        }
    }
    return best.playerId;
}

/** Vacuously true before the first trick. */
function sideWonAll(
    tricks: readonly CompletedTrick[],
    playerId: string,
    taker: string | null,
): boolean {
    const isTakerSide = playerId === taker;
    return tricks.every((t) => (t.winnerId === taker) === isTakerSide);
}

/** Never Kings or bouts; trumps only once plain cards can't complete the six. */
export function discardableCards(
    hand: readonly CardDescriptor[],
    buried: number,
): CardDescriptor[] {
    const need = ECART_SIZE - buried;
    const plain = hand.filter(
        (c) => !isKing(c) && !isBout(c) && c.type !== "trump",
    );
    if (plain.length >= need) return plain;
    const trumps = hand.filter((c) => isTrump(c) && !isBout(c));
    return [...plain, ...trumps];
}

function highestBid(
    bids: Readonly<Record<string, Bid | "pass">>,
): { bid: Bid; player: string } | null {
    let best: { bid: Bid; player: string } | null = null;
    for (const [player, b] of Object.entries(bids)) {
        if (b === "pass") continue;
        if (!best || BID_RANK[b] > BID_RANK[best.bid])
            best = { bid: b, player };
    }
    return best;
}

function availableBids(floor: number, rules: TarotRules): Bid[] {
    return ALL_BIDS.filter(
        (b) =>
            BID_RANK[b] > floor &&
            (rules.gardeSansContre ||
                (b !== "garde-sans" && b !== "garde-contre")),
    );
}

function nextSeat(players: readonly Player[], id: string): string {
    return seatAfter(players, id) ?? id;
}

/** Round-robin from the eldest; the last six form the chien (a uniform shuffle makes that fair). */
function deal(
    players: readonly Player[],
    eldestId: string,
    rng: Rng,
): {
    hands: Record<string, readonly CardDescriptor[]>;
    chien: readonly CardDescriptor[];
} {
    const order = rotateFrom(players, eldestId);
    const deck = rng.shuffle(buildDeck(tarot78));
    const dealt = dealRoundRobin(
        deck.slice(0, deck.length - CHIEN_SIZE),
        order.length,
    );
    const hands: Record<string, readonly CardDescriptor[]> = {};
    order.forEach((p, i) => {
        hands[p.id] = dealt[i];
    });
    return { hands, chien: deck.slice(deck.length - CHIEN_SIZE) };
}

/** Strict validation first: `cardKey` alone would let `index: "1"` pass for the Petit. */
function heldCard(
    hand: readonly CardDescriptor[],
    card: unknown,
): CardDescriptor | null {
    if (!isCardDescriptor(card)) return null;
    const key = cardKey(card);
    return hand.find((c) => cardKey(c) === key) ?? null;
}

/** Strongest first — the order a handful is laid. */
function byTrumpDesc(a: CardDescriptor, b: CardDescriptor): number {
    const rank = (c: CardDescriptor) => (isTrump(c) ? c.index : 0);
    return rank(b) - rank(a);
}

function hasPlayed(state: TarotState, playerId: string): boolean {
    return (
        state.pile.some((p) => p.playerId === playerId) ||
        state.tricks.some((t) => t.plays.some((p) => p.playerId === playerId))
    );
}

/**
 * Exactly N trumps, the strongest; the Excuse may complete it only as the
 * last missing trump (which implies no other is held). `null` if unreachable.
 */
export function handfulAt(
    hand: readonly CardDescriptor[],
    level: HandfulLevel,
    playerCount: number,
): readonly CardDescriptor[] | null {
    const n = handfulSize(level, playerCount);
    const trumps = hand.filter(isTrump).sort(byTrumpDesc);
    if (trumps.length >= n) return trumps.slice(0, n);
    const excuse = hand.find((c) => c.type === "fool");
    if (excuse && trumps.length === n - 1) return [...trumps, excuse];
    return null;
}

export function bestHandful(
    hand: readonly CardDescriptor[],
    playerCount: number,
): DeclaredHandful | null {
    for (const level of [...HANDFUL_LEVELS].reverse()) {
        const cards = handfulAt(hand, level, playerCount);
        if (cards) return { level, cards };
    }
    return null;
}

/** A client-named handful: N distinct held trumps, the Excuse only alongside every held trump. */
function validateHandful(
    hand: readonly CardDescriptor[],
    level: HandfulLevel,
    cards: unknown,
    playerCount: number,
): readonly CardDescriptor[] | null {
    if (!Array.isArray(cards)) return null;
    if (cards.length !== handfulSize(level, playerCount)) return null;
    const held: CardDescriptor[] = [];
    for (const raw of cards) {
        const card = heldCard(hand, raw);
        if (!card || (card.type !== "trump" && card.type !== "fool")) {
            return null;
        }
        if (held.some((c) => cardKey(c) === cardKey(card))) return null;
        held.push(card);
    }
    const showsExcuse = held.some((c) => c.type === "fool");
    if (
        showsExcuse &&
        held.filter(isTrump).length < hand.filter(isTrump).length
    ) {
        return null;
    }
    return held.sort(byTrumpDesc);
}

function beginPlay(state: TarotState, leader: string): TarotState {
    return {
        ...state,
        phase: "playing",
        currentPlayerId: leader,
        trickLeaderId: leader,
    };
}

/** Contract settled: the taker decides on the slam first when that rule is on. */
function startPlay(state: TarotState, taker: string): TarotState {
    if (state.rules.announcedSlam) {
        return { ...state, phase: "slam", currentPlayerId: taker };
    }
    return beginPlay(state, state.eldestId);
}

/** Everyone has spoken: take the contract into the dog or the play, or redeal on an all-pass. */
function resolveBidding(
    state: TarotState,
    rng: Rng,
): {
    state: TarotState;
    events: GameEvent[];
} {
    const best = highestBid(state.bids);
    if (!best) {
        // A void deal never "finishes", so it can't feed ELO as a fake draw.
        const eldestId = nextSeat(state.players, state.eldestId);
        const { hands, chien } = deal(state.players, eldestId, rng);
        return {
            state: {
                ...state,
                phase: "bidding",
                redeals: state.redeals + 1,
                eldestId,
                currentPlayerId: eldestId,
                hands,
                chien,
                bids: {},
            },
            events: [
                { type: "passed_out" },
                { type: "redeal", payload: { playerId: eldestId } },
            ],
        };
    }

    const taker = best.player;
    const contract = best.bid;
    const events: GameEvent[] = [
        { type: "contract", payload: { playerId: taker, contract } },
    ];

    if (contract === "petite" || contract === "garde") {
        events.push({ type: "chien_revealed", payload: { contract } });
        return {
            state: {
                ...state,
                phase: "dog",
                taker,
                contract,
                currentPlayerId: taker,
                hands: {
                    ...state.hands,
                    [taker]: [...state.hands[taker], ...state.chien],
                },
            },
            events,
        };
    }

    return {
        state: startPlay({ ...state, taker, contract }, taker),
        events,
    };
}

/** Attribute a full trick, hand the lead to its winner, and score once every hand is empty. */
function closeTrick(
    state: TarotState,
    pile: readonly TrickCard[],
): { state: TarotState; events: GameEvent[] } {
    const leaderId = state.trickLeaderId ?? pile[0].playerId;
    const handsEmpty = state.players.every(
        (p) => state.hands[p.id].length === 0,
    );
    const winnerId = trickWinner(pile, {
        isLastTrick: handsEmpty,
        leaderSideWonAll: sideWonAll(state.tricks, leaderId, state.taker),
    });
    const trick: CompletedTrick = { leaderId, plays: pile, winnerId };
    const tricks = [...state.tricks, trick];
    const events: GameEvent[] = [
        { type: "trick_won", payload: { playerId: winnerId } },
    ];

    if (!handsEmpty) {
        return {
            state: {
                ...state,
                pile: [],
                tricks,
                lastTrick: trick,
                trickLeaderId: winnerId,
                currentPlayerId: winnerId,
            },
            events,
        };
    }

    if (!state.taker || !state.contract) {
        throw new Error("tarot: deal played out without a contract");
    }
    const result = scoreDeal({
        players: state.players.map((p) => p.id),
        taker: state.taker,
        contract: state.contract,
        tricks,
        chien: state.chien,
        ecart: state.ecart,
        rules: state.rules,
        handfuls: state.handfuls,
        slamAnnounced: state.slamAnnounced,
    });
    events.push({
        type: "game_over",
        payload: { made: result.made, taker: state.taker },
    });
    return {
        state: {
            ...state,
            phase: "done",
            pile: [],
            tricks,
            lastTrick: trick,
            trickLeaderId: null,
            currentPlayerId: state.taker,
            result,
        },
        events,
    };
}

export const TAROT_RULE_TOGGLES = defineRules(DEFAULT_TAROT_RULES, {
    announcedSlam: "slam",
});

const TAROT_RULE_MODES: readonly GameRuleMode[] = [
    { key: "tarot_fft", rules: {} },
    {
        key: "tarot_simple",
        rules: {
            gardeSansContre: false,
            petitAuBout: false,
            slam: false,
            announcedSlam: false,
            handful: false,
        },
    },
];

const base: Omit<GameModule<TarotState, TarotAction, TarotView>, "setup"> = {
    id: "tarot",
    name: "Tarot",
    deck: tarot78,
    minPlayers: 3,
    maxPlayers: 4,
    ruleToggles: TAROT_RULE_TOGGLES,
    ruleModes: TAROT_RULE_MODES,
    // A random bot announcing a slam would only ever pay the penalty.
    riskyActions: ["announceSlam"],

    legalActions(state, playerId) {
        if (state.phase === "done") return [];
        if (playerId !== state.currentPlayerId) return [];

        if (state.phase === "bidding") {
            const best = highestBid(state.bids);
            const floor = best ? BID_RANK[best.bid] : 0;
            const actions: TarotAction[] = availableBids(
                floor,
                state.rules,
            ).map((bid) => ({ type: "bid", playerId, bid }));
            actions.push({ type: "pass", playerId });
            return actions;
        }

        if (state.phase === "dog") {
            return discardableCards(
                state.hands[playerId],
                state.ecart.length,
            ).map((card) => ({ type: "discard", playerId, card }));
        }

        if (state.phase === "slam") {
            return [
                { type: "announceSlam", playerId },
                { type: "pass", playerId },
            ];
        }

        const actions: TarotAction[] = legalCards(
            state.hands[playerId],
            state.pile,
        ).map((card) => ({ type: "play", playerId, card }));
        if (
            state.rules.handful &&
            !state.handfuls?.[playerId] &&
            !hasPlayed(state, playerId)
        ) {
            const best = bestHandful(
                state.hands[playerId],
                state.players.length,
            );
            if (best) {
                actions.push({ type: "handful", playerId, level: best.level });
            }
        }
        return actions;
    },

    apply(state, action, rng) {
        if (action.playerId !== state.currentPlayerId) {
            return fail("not_your_turn", "It is not this player's turn.");
        }

        if (state.phase === "bidding") {
            if (action.type !== "bid" && action.type !== "pass") {
                return fail("wrong_phase", "Bidding expects a bid or a pass.");
            }
            const best = highestBid(state.bids);
            const floor = best ? BID_RANK[best.bid] : 0;
            if (action.type === "bid") {
                if (!ALL_BIDS.includes(action.bid)) {
                    return fail("bad_bid", "Unknown contract.");
                }
                if (BID_RANK[action.bid] <= floor) {
                    return fail(
                        "bid_too_low",
                        "Must overcall the current bid.",
                    );
                }
                if (!availableBids(floor, state.rules).includes(action.bid)) {
                    return fail("bid_not_allowed", "That bid is disabled.");
                }
            }

            const bids = {
                ...state.bids,
                [action.playerId]:
                    action.type === "bid" ? action.bid : ("pass" as const),
            };
            const events: GameEvent[] = [
                action.type === "bid"
                    ? {
                          type: "bid",
                          payload: {
                              playerId: action.playerId,
                              bid: action.bid,
                          },
                      }
                    : {
                          type: "passed",
                          payload: { playerId: action.playerId },
                      },
            ];

            const order = rotateFrom(state.players, state.eldestId);
            const spoken = Object.keys(bids).length;
            const advanced: TarotState = { ...state, bids };

            if (spoken < order.length) {
                return {
                    ok: true,
                    state: { ...advanced, currentPlayerId: order[spoken].id },
                    events,
                };
            }

            const resolved = resolveBidding(advanced, rng);
            return {
                ok: true,
                state: resolved.state,
                events: [...events, ...resolved.events],
            };
        }

        if (state.phase === "dog") {
            if (action.type !== "discard") {
                return fail("wrong_phase", "Bury a card to form the écart.");
            }
            const hand = state.hands[action.playerId];
            const took = takeCards(hand, [action.card]);
            if (!took) {
                return fail("not_in_hand", "Buried a card not held in hand.");
            }
            const held = took.taken[0];
            const legal = discardableCards(hand, state.ecart.length);
            if (!legal.some((c) => cardKey(c) === cardKey(held))) {
                return fail(
                    "illegal_discard",
                    "Kings, bouts and (unless forced) trumps stay in hand.",
                );
            }

            const buried: TarotState = {
                ...state,
                hands: { ...state.hands, [action.playerId]: took.remaining },
                ecart: [...state.ecart, held],
            };
            const events: GameEvent[] = [
                { type: "discarded", payload: { playerId: action.playerId } },
            ];
            if (buried.ecart.length < ECART_SIZE) {
                return { ok: true, state: buried, events };
            }
            return {
                ok: true,
                state: startPlay(buried, action.playerId),
                events: [...events, { type: "ecart_done" }],
            };
        }

        if (state.phase === "slam") {
            if (action.type === "pass") {
                return {
                    ok: true,
                    state: beginPlay(state, state.eldestId),
                    events: [
                        {
                            type: "slam_declined",
                            payload: { playerId: action.playerId },
                        },
                    ],
                };
            }
            if (action.type !== "announceSlam") {
                return fail(
                    "wrong_phase",
                    "Announce a slam or pass before the first card.",
                );
            }
            // « L'entame revient de droit au joueur qui l'a demandé. »
            return {
                ok: true,
                state: beginPlay(
                    { ...state, slamAnnounced: true },
                    action.playerId,
                ),
                events: [
                    {
                        type: "slam_announced",
                        payload: { playerId: action.playerId },
                    },
                ],
            };
        }

        if (action.type === "handful") {
            if (!state.rules.handful) {
                return fail("rule_disabled", "Handfuls are not in play.");
            }
            if (state.handfuls?.[action.playerId]) {
                return fail("already_shown", "A handful is shown only once.");
            }
            if (hasPlayed(state, action.playerId)) {
                return fail(
                    "too_late",
                    "A handful is shown just before your first card.",
                );
            }
            if (!HANDFUL_LEVELS.includes(action.level)) {
                return fail("bad_handful", "Unknown handful level.");
            }
            const hand = state.hands[action.playerId];
            const players = state.players.length;
            // A lower level than held is allowed — it hides more.
            const cards =
                action.cards === undefined
                    ? handfulAt(hand, action.level, players)
                    : validateHandful(
                          hand,
                          action.level,
                          action.cards,
                          players,
                      );
            if (!cards) {
                return fail(
                    "illegal_handful",
                    "Not enough trumps for that handful.",
                );
            }
            return {
                ok: true,
                state: {
                    ...state,
                    handfuls: {
                        ...state.handfuls,
                        [action.playerId]: { level: action.level, cards },
                    },
                },
                events: [
                    {
                        type: "handful",
                        payload: {
                            playerId: action.playerId,
                            level: action.level,
                        },
                    },
                ],
            };
        }
        if (action.type !== "play") {
            return fail("wrong_phase", "Play a card to the trick.");
        }
        const hand = state.hands[action.playerId];
        const took = takeCards(hand, [action.card]);
        if (!took) {
            return fail("not_in_hand", "Played a card not held in hand.");
        }
        // The canonical held card goes on the table — never the client's object.
        const held = took.taken[0];
        const legal = legalCards(hand, state.pile);
        if (!legal.some((c) => cardKey(c) === cardKey(held))) {
            return fail("illegal_play", "Must follow suit, trump, or excuse.");
        }

        const leadingNow = state.pile.length === 0;
        const pile = [...state.pile, { playerId: action.playerId, card: held }];
        const withPlay: TarotState = {
            ...state,
            hands: { ...state.hands, [action.playerId]: took.remaining },
            pile,
            trickLeaderId: leadingNow ? action.playerId : state.trickLeaderId,
            lastTrick: leadingNow ? null : state.lastTrick,
        };
        const events: GameEvent[] = [
            {
                type: "played",
                payload: { playerId: action.playerId, card: { ...held } },
            },
        ];

        if (pile.length < state.players.length) {
            return {
                ok: true,
                state: {
                    ...withPlay,
                    currentPlayerId: nextSeat(state.players, action.playerId),
                },
                events,
            };
        }

        const closed = closeTrick(withPlay, pile);
        return {
            ok: true,
            state: closed.state,
            events: [...events, ...closed.events],
        };
    },

    isOver(state) {
        return state.phase === "done";
    },

    outcome(state) {
        if (state.phase !== "done") return null;
        // An all-pass deal is redealt, never finished: `done` always has a result.
        const { result } = state;
        if (!result) throw new Error("tarot: finished deal without a result");
        // Taker vs. defenders by signed score — defenders always share a rank.
        return rankByScore(
            state.players.map((p) => ({
                playerId: p.id,
                score: result.scores[p.id],
            })),
            { higherIsBetter: true },
        );
    },

    view(state, viewerId) {
        const best = highestBid(state.bids);
        const wins: Record<string, number> = {};
        for (const t of state.tricks) {
            wins[t.winnerId] = (wins[t.winnerId] ?? 0) + 1;
        }
        const chienRevealed = state.phase === "dog" || state.phase === "done";
        const showingLast = state.pile.length === 0 && state.lastTrick;

        return {
            gameId: state.gameId,
            phase: state.phase,
            turn: state.turn,
            currentPlayerId: state.currentPlayerId,
            rules: state.rules,
            taker: state.taker,
            contract: state.contract,
            redeals: state.redeals,
            highestBid: best?.bid ?? null,
            chien: chienRevealed ? state.chien : [],
            chienRevealed,
            ecartCount: state.ecart.length,
            pile: state.pile,
            trickLeaderId: state.trickLeaderId,
            displayTrick: showingLast
                ? {
                      plays: showingLast.plays,
                      wonBy: showingLast.winnerId,
                  }
                : { plays: state.pile, wonBy: null },
            result: state.result,
            slamAnnounced: state.slamAnnounced === true,
            self: viewerId,
            players: seatOrder(state.players).map((p): TarotPlayerView => {
                const slot: TarotPlayerView = {
                    playerId: p.id,
                    name: p.name,
                    handCount: state.hands[p.id].length,
                    isTaker: state.taker === p.id,
                    bid: state.bids[p.id] ?? null,
                    trickWins: wins[p.id] ?? 0,
                    handful: state.handfuls?.[p.id] ?? null,
                };
                return viewerId === p.id
                    ? { ...slot, hand: state.hands[p.id] }
                    : slot;
            }),
        };
    },
};

function createTarot(
    rules: TarotRules = DEFAULT_TAROT_RULES,
): GameModule<TarotState, TarotAction, TarotView> {
    return {
        ...base,
        withRules(chosen) {
            // Rules added after launch stay absent unless named, so a legacy
            // game's persisted rules rebuild exactly (absent = off).
            return createTarot(
                bindRules(chosen, DEFAULT_TAROT_RULES, {
                    legacyOptional: ["handful", "announcedSlam"],
                }),
            );
        },
        setup(players, rng, seed, gameId) {
            const eldestId = seatOrder(players)[0].id;
            const { hands, chien } = deal(players, eldestId, rng);

            return {
                gameId,
                players,
                phase: "bidding",
                currentPlayerId: eldestId,
                turn: 0,
                seed,
                rngState: rng.state,
                rules,
                eldestId,
                hands,
                bids: {},
                taker: null,
                contract: null,
                redeals: 0,
                chien,
                ecart: [],
                pile: [],
                trickLeaderId: null,
                tricks: [],
                lastTrick: null,
                result: null,
            };
        },
    };
}

export const tarot = createTarot();
