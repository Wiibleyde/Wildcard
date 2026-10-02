import { tarot78 } from "@/lib/card/decks";
import { dealRoundRobin, removeCards } from "@/lib/card/hand";
import { buildRankOrder } from "@/lib/card/rank";
import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey, isCardDescriptor } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import { fail, seatOrder } from "@/lib/engine/rules";
import type {
    GameEvent,
    GameModule,
    GameRuleMode,
    GameRuleToggle,
    GameState,
    Player,
} from "@/lib/engine/types";
import {
    BID_RANK,
    type Bid,
    type CompletedTrick,
    DEFAULT_TAROT_RULES,
    type DealResult,
    isBout,
    scoreDeal,
    type TarotRules,
    type TrickCard,
} from "./scoring";

/**
 * Tarot français (3–4 joueurs) — the catalog's most complex module and the
 * engine's *multi-phase* proof. Where Président rotates a single play action,
 * Tarot runs three distinct sub-games behind one `GameModule`:
 *
 *   bidding ─▶ dog (chien / écart) ─▶ playing (jeu de la carte) ─▶ done
 *
 * - **Bidding** (« enchères ») — one round, each player passes or overcalls
 *   with a strictly higher contract (Petite ▸ Garde ▸ Garde Sans ▸ Garde
 *   Contre). The highest bidder is the *taker* (« preneur »), alone against
 *   the others (« défenseurs »).
 * - **Dog** (« le chien ») — on Petite/Garde the taker takes the six face-up
 *   chien cards into hand, then buries six of their own (« l'écart »); Kings
 *   and bouts may never be buried, trumps only when nothing else is left.
 *   Garde Sans skips it (chien scores for the taker), Garde Contre too (chien
 *   scores for the defence).
 * - **Playing** — 18 (or 24) tricks. Follow suit; if void, you must trump and
 *   over-trump when able; the Excuse (« L'Excuse ») excuses you from following
 *   and almost always returns to its player.
 * - **Scoring** lives in {@link scoreDeal}: the famous count-to-a-threshold set
 *   by the number of bouts the taker captured (36/41/51/56 points).
 *
 * The four engine guarantees hold: determinism (seeded shuffle in `state`),
 * `view()` as in-code RLS (a player only ever sees their own hand and the
 * public chien), server-validated `apply` (illegal plays refused), and a pure
 * `outcome()` feeding ELO/XP.
 *
 * Out of scope by design (single-deal meta layer / extra annotations, like
 * Président's card exchange): the 5-player « roi appelé » partnership, declared
 * poignées, and announced chelems. Chelem here is auto-detected, unannounced.
 */

/** Suited strength inside one suit: 1(A) low → King high (K>Q>C>J>10>…>1).
 * Shared with the table adapter's hand sort so there is one source of truth. */
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

const DECK_SIZE = 78;
const CHIEN_SIZE = 6;
const ECART_SIZE = 6;

export type TarotPhase = "bidding" | "dog" | "playing" | "done";

export interface TarotState extends GameState {
    readonly phase: TarotPhase;
    /** Always a seated player while the game runs; the taker at `done`. */
    readonly currentPlayerId: string;
    /** Lobby-chosen rules — stamped in so any instance replays identically. */
    readonly rules: TarotRules;
    /** Eldest hand (« à la droite du donneur ») — opens bidding, leads trick 1. */
    readonly eldestId: string;

    readonly hands: Readonly<Record<string, readonly CardDescriptor[]>>;

    // ── bidding ──────────────────────────────────────────────────────────────
    /** Each player's spoken bid; absent until they have bid. */
    readonly bids: Readonly<Record<string, Bid | "pass">>;
    readonly taker: string | null;
    readonly contract: Bid | null;
    /** Times the cards were redealt because everyone passed (« tout le monde
     * passe »). Each redeal reshuffles from the seeded RNG and moves the deal
     * one seat on, so it stays a pure function of (seed, action log). */
    readonly redeals: number;

    // ── dog / écart ───────────────────────────────────────────────────────────
    /** The six chien cards (public on Petite/Garde once bidding resolves). */
    readonly chien: readonly CardDescriptor[];
    /** Cards the taker has buried so far (secret to everyone else). */
    readonly ecart: readonly CardDescriptor[];

    // ── trick play ────────────────────────────────────────────────────────────
    readonly pile: readonly TrickCard[];
    readonly trickLeaderId: string | null;
    readonly tricks: readonly CompletedTrick[];
    /** The just-won trick, kept on the table until the next lead is laid. */
    readonly lastTrick: CompletedTrick | null;

    // ── result ────────────────────────────────────────────────────────────────
    readonly result: DealResult | null;
}

export type TarotAction =
    | { readonly type: "bid"; readonly playerId: string; readonly bid: Bid }
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
      };

export interface TarotPlayerView {
    readonly playerId: string;
    readonly name: string;
    readonly handCount: number;
    readonly isTaker: boolean;
    /** Public bid once spoken (`null` while still to bid / after the deal). */
    readonly bid: Bid | "pass" | null;
    /** Tricks this player has won — public. */
    readonly trickWins: number;
    /** Own cards — present only in the viewer's own slot (RLS in code). */
    readonly hand?: readonly CardDescriptor[];
}

export interface TarotView {
    readonly gameId: string;
    readonly phase: TarotPhase;
    readonly turn: number;
    readonly currentPlayerId: string;
    readonly rules: TarotRules;
    readonly taker: string | null;
    readonly contract: Bid | null;
    readonly redeals: number;
    /** Strongest bid so far — drives the legal overcalls in the UI. */
    readonly highestBid: Bid | null;
    /** The chien, revealed during the dog phase and at game end; else `[]`. */
    readonly chien: readonly CardDescriptor[];
    readonly chienRevealed: boolean;
    /** How many of the six écart cards the taker has buried. */
    readonly ecartCount: number;
    readonly pile: readonly TrickCard[];
    readonly trickLeaderId: string | null;
    /** The previous trick, shown until the next lead (empty mid-trick). */
    readonly lastTrick: CompletedTrick | null;
    readonly result: DealResult | null;
    readonly players: readonly TarotPlayerView[];
    /** Viewer this projection was built for (`null` = spectator). */
    readonly self: string | null;
}

// ── pure card-rule helpers ────────────────────────────────────────────────────

function isTrump(
    c: CardDescriptor,
): c is Extract<CardDescriptor, { type: "trump" }> {
    return c.type === "trump";
}

function isKing(c: CardDescriptor): boolean {
    return c.type === "suited" && c.rank === "K";
}

/** Highest trump index already in the trick, or 0 when none has been laid. */
function topTrump(pile: readonly TrickCard[]): number {
    return pile.reduce(
        (max, p) => (isTrump(p.card) ? Math.max(max, p.card.index) : max),
        0,
    );
}

type Required =
    | { readonly kind: "free" }
    | { readonly kind: "suit"; readonly suit: Suit }
    | { readonly kind: "trump" };

/** What the trick demands: set by the first non-Excuse card (a fresh lead, or a
 * pile holding only the Excuse, is free — the next real card sets the suit). */
function requiredSuit(pile: readonly TrickCard[]): Required {
    const lead = pile.find((p) => p.card.type !== "fool");
    if (!lead) return { kind: "free" };
    if (lead.card.type === "trump") return { kind: "trump" };
    if (lead.card.type === "suited") {
        return { kind: "suit", suit: lead.card.suit };
    }
    return { kind: "free" };
}

function dedupe(cards: readonly CardDescriptor[]): CardDescriptor[] {
    const seen = new Set<string>();
    const out: CardDescriptor[] = [];
    for (const c of cards) {
        const k = cardKey(c);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
    }
    return out;
}

/**
 * The cards `hand` may legally play onto `pile`, enforcing the full « jeu de la
 * carte »: follow the led suit if able; if void, trump and over-trump when you
 * can; the Excuse may always be played. A fresh lead allows anything.
 */
export function legalCards(
    hand: readonly CardDescriptor[],
    pile: readonly TrickCard[],
): CardDescriptor[] {
    const req = requiredSuit(pile);
    if (req.kind === "free") return [...hand];

    const fool = hand.filter((c) => c.type === "fool");
    const trumps = hand.filter(isTrump);
    const high = topTrump(pile);
    const overTrumps = trumps.filter((c) => c.index > high);
    const mustTrump = overTrumps.length > 0 ? overTrumps : trumps;

    if (req.kind === "suit") {
        const suited = hand.filter(
            (c) => c.type === "suited" && c.suit === req.suit,
        );
        if (suited.length > 0) return dedupe([...suited, ...fool]);
        if (trumps.length > 0) return dedupe([...mustTrump, ...fool]);
        return [...hand]; // void in suit and trumps — discard anything
    }

    // Led suit is trump.
    if (trumps.length > 0) return dedupe([...mustTrump, ...fool]);
    return [...hand]; // no trump to follow with — discard anything
}

/** Where a trick sits in the deal — only needed for the Excuse-au-chelem rule. */
export interface TrickContext {
    /** This is the deal's final trick (every hand is now empty). */
    readonly isLastTrick: boolean;
    /** The side of the player who led this trick won every previous trick. */
    readonly leaderSideWonAll: boolean;
}

/**
 * Resolve a completed trick's winner: highest trump, else highest card of the
 * led suit. The Excuse never wins — with one FFT exception: a side that has won
 * every previous trick and *leads* the Excuse to the last trick wins that trick
 * with it, so playing the Excuse last never breaks a chelem.
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
    if (!lead || lead.card.type !== "suited") {
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

/** Did `playerId`'s side (taker vs. defence) win every trick in `tricks`?
 * Vacuously true before the first trick. */
function sideWonAll(
    tricks: readonly CompletedTrick[],
    playerId: string,
    taker: string | null,
): boolean {
    const isTakerSide = playerId === taker;
    return tricks.every((t) => (t.winnerId === taker) === isTakerSide);
}

/**
 * Cards the taker may bury in the écart right now. Kings and bouts are never
 * allowed; trumps only become legal once there aren't enough plain cards left
 * to reach six — so the taker can always complete a legal écart.
 */
export function discardableCards(
    hand: readonly CardDescriptor[],
    buried: number,
): CardDescriptor[] {
    const need = ECART_SIZE - buried;
    const plain = hand.filter(
        (c) => !isKing(c) && !isBout(c) && c.type !== "trump",
    );
    if (plain.length >= need) return plain;
    // Forced to bury trumps (never the bout trumps 1 / 21).
    const trumps = hand.filter((c) => isTrump(c) && !isBout(c));
    return [...plain, ...trumps];
}

/** Strongest bid spoken so far, with its bidder, or `null` if all passed. */
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

/** Bids that strictly overcall `floor` and are permitted by the rules. */
function availableBids(floor: number, rules: TarotRules): Bid[] {
    return ALL_BIDS.filter(
        (b) =>
            BID_RANK[b] > floor &&
            (rules.gardeSansContre ||
                (b !== "garde-sans" && b !== "garde-contre")),
    );
}

/** Players in turn order starting from `eldestId` (bidding / dealing order). */
function orderFrom(
    players: readonly Player[],
    eldestId: string,
): readonly Player[] {
    const order = seatOrder(players);
    const start = Math.max(
        0,
        order.findIndex((p) => p.id === eldestId),
    );
    return [...order.slice(start), ...order.slice(0, start)];
}

/**
 * Shuffle a full deck and deal it: 72 cards round-robin from the eldest hand,
 * the last six form the chien. A uniform shuffle makes which cards land in the
 * chien uniformly random — the traditional packet-deal ritual only matters at a
 * physical table.
 */
function deal(
    players: readonly Player[],
    eldestId: string,
    rng: Rng,
): {
    hands: Record<string, readonly CardDescriptor[]>;
    chien: readonly CardDescriptor[];
} {
    const order = orderFrom(players, eldestId);
    const deck = rng.shuffle(buildDeck(tarot78));
    const dealt = dealRoundRobin(
        deck.slice(0, DECK_SIZE - CHIEN_SIZE),
        order.length,
    );
    const hands: Record<string, readonly CardDescriptor[]> = {};
    order.forEach((p, i) => {
        hands[p.id] = dealt[i];
    });
    return { hands, chien: deck.slice(DECK_SIZE - CHIEN_SIZE) };
}

/**
 * The canonical card in `hand` matching an untrusted client card, or `null`.
 * Strict shape validation first: `cardKey` alone stringifies, so a trump sent
 * as `index: "1"` would otherwise pass for the Petit.
 */
function heldCard(
    hand: readonly CardDescriptor[],
    card: unknown,
): CardDescriptor | null {
    if (!isCardDescriptor(card)) return null;
    const key = cardKey(card);
    return hand.find((c) => cardKey(c) === key) ?? null;
}

/** Next seat after `id`, cyclically — turn order within a trick. */
function nextSeat(state: TarotState, id: string): string {
    const order = seatOrder(state.players);
    const idx = order.findIndex((p) => p.id === id);
    return order[(idx + 1) % order.length].id;
}

// ── bidding resolution ────────────────────────────────────────────────────────

/**
 * Bidding is over (everyone has spoken). Resolve the contract and move into the
 * dog or straight to the trick play — or end the deal if all passed.
 */
function resolveBidding(
    state: TarotState,
    rng: Rng,
): {
    state: TarotState;
    events: GameEvent[];
} {
    const best = highestBid(state.bids);
    if (!best) {
        // « Tout le monde passe » — the deal is void: shuffle a fresh deck from
        // the seeded RNG and pass the deal one seat on, as at a real table. A
        // void deal is never "finished", so it can't feed ELO/history as a
        // fake four-way draw.
        const eldestId = nextSeat(state, state.eldestId);
        const { hands, chien } = deal(state.players, eldestId, rng);
        return {
            state: {
                ...state,
                phase: "bidding",
                rngState: rng.state,
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

    // Petite / Garde: the taker picks up the chien and must bury six. Garde Sans
    // / Garde Contre skip the dog — the chien scores untouched for one side.
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
        state: {
            ...state,
            phase: "playing",
            taker,
            contract,
            currentPlayerId: state.eldestId,
            trickLeaderId: state.eldestId,
        },
        events,
    };
}

// ── trick resolution ──────────────────────────────────────────────────────────

/** Close a full trick: attribute it, hand the lead to its winner, and end the
 * deal once every hand is empty (scoring the result). */
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

    if (handsEmpty && state.taker && state.contract) {
        const result = scoreDeal({
            players: state.players.map((p) => p.id),
            taker: state.taker,
            contract: state.contract,
            tricks,
            chien: state.chien,
            ecart: state.ecart,
            rules: state.rules,
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

// ── module ────────────────────────────────────────────────────────────────────

export const TAROT_RULE_TOGGLES: readonly GameRuleToggle[] = [
    { key: "gardeSansContre", default: true },
    { key: "petitAuBout", default: true },
    { key: "slam", default: true },
];

/**
 * Launch presets. The FFT rules (Fédération Française de Tarot, the reference
 * rulebook) first — the default; then a beginner table with only Petite/Garde
 * and none of the bonus primes.
 */
export const TAROT_RULE_MODES: readonly GameRuleMode[] = [
    { key: "tarot_fft", rules: {} },
    {
        key: "tarot_simple",
        rules: { gardeSansContre: false, petitAuBout: false, slam: false },
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

        // playing
        return legalCards(state.hands[playerId], state.pile).map((card) => ({
            type: "play",
            playerId,
            card,
        }));
    },

    apply(state, action, rng: Rng) {
        if (state.phase === "done") {
            return fail("game_over", "The deal has already finished.");
        }
        if (action.playerId !== state.currentPlayerId) {
            return fail("not_your_turn", "It is not this player's turn.");
        }

        // ── bidding ───────────────────────────────────────────────────────────
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

            // Bidding runs from the eldest hand, which moves on each redeal.
            const order = orderFrom(state.players, state.eldestId);
            const spoken = Object.keys(bids).length;
            const advanced: TarotState = {
                ...state,
                bids,
                turn: state.turn + 1,
            };

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

        // ── dog / écart ─────────────────────────────────────────────────────────
        if (state.phase === "dog") {
            if (action.type !== "discard") {
                return fail("wrong_phase", "Bury a card to form the écart.");
            }
            const hand = state.hands[action.playerId];
            const held = heldCard(hand, action.card);
            if (!held) {
                return fail("not_in_hand", "Buried a card not held in hand.");
            }
            const legal = discardableCards(hand, state.ecart.length);
            if (!legal.some((c) => cardKey(c) === cardKey(held))) {
                return fail(
                    "illegal_discard",
                    "Kings, bouts and (unless forced) trumps stay in hand.",
                );
            }
            const remaining = removeCards(hand, [held]);
            if (remaining === null) {
                return fail("not_in_hand", "Buried a card not held in hand.");
            }

            // Store the canonical held card, never the client's object.
            const ecart = [...state.ecart, held];
            const events: GameEvent[] = [
                { type: "discarded", payload: { playerId: action.playerId } },
            ];

            // Six buried — the écart is set; the eldest hand leads trick one.
            if (ecart.length === ECART_SIZE) {
                return {
                    ok: true,
                    state: {
                        ...state,
                        phase: "playing",
                        hands: {
                            ...state.hands,
                            [action.playerId]: remaining,
                        },
                        ecart,
                        currentPlayerId: state.eldestId,
                        trickLeaderId: state.eldestId,
                    },
                    events: [...events, { type: "ecart_done" }],
                };
            }

            return {
                ok: true,
                state: {
                    ...state,
                    hands: { ...state.hands, [action.playerId]: remaining },
                    ecart,
                },
                events,
            };
        }

        // ── playing ──────────────────────────────────────────────────────────────
        if (action.type !== "play") {
            return fail("wrong_phase", "Play a card to the trick.");
        }
        const hand = state.hands[action.playerId];
        const held = heldCard(hand, action.card);
        if (!held) {
            return fail("not_in_hand", "Played a card not held in hand.");
        }
        const legal = legalCards(hand, state.pile);
        if (!legal.some((c) => cardKey(c) === cardKey(held))) {
            return fail("illegal_play", "Must follow suit, trump, or excuse.");
        }
        const remaining = removeCards(hand, [held]);
        if (remaining === null) {
            return fail("not_in_hand", "Played a card not held in hand.");
        }

        // A fresh lead clears the previous trick still on display.
        const leadingNow = state.pile.length === 0;
        // The canonical held card goes on the table (and to scoring/events) —
        // never the client's object, which may carry a lookalike or junk.
        const pile = [...state.pile, { playerId: action.playerId, card: held }];
        const withPlay: TarotState = {
            ...state,
            hands: { ...state.hands, [action.playerId]: remaining },
            pile,
            trickLeaderId: leadingNow ? action.playerId : state.trickLeaderId,
            lastTrick: leadingNow ? null : state.lastTrick,
            turn: state.turn + 1,
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
                    currentPlayerId: nextSeat(state, action.playerId),
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

        // Every `done` state carries a result: a passed-out deal is redealt
        // instead of ending, so there is no void outcome to report.
        if (!state.result) return null;
        const ids = state.players.map((p) => p.id);

        // Taker vs. defenders: the two sides win or lose together, so defenders
        // always share a rank. Rank by final signed score, taker's `score`
        // carried through for transparency.
        const result = state.result;
        const ranked = [...ids].sort(
            (a, b) => result.scores[b] - result.scores[a],
        );
        let rank = 1;
        const rankings = ranked.map((playerId, i) => {
            if (
                i > 0 &&
                result.scores[playerId] !== result.scores[ranked[i - 1]]
            ) {
                rank = i + 1;
            }
            return { playerId, rank, score: result.scores[playerId] };
        });
        const top = rankings[0].score;
        return {
            rankings,
            winners: rankings
                .filter((r) => r.score === top)
                .map((r) => r.playerId),
        };
    },

    view(state, viewerId) {
        const order = seatOrder(state.players);
        const best = highestBid(state.bids);
        const wins: Record<string, number> = {};
        for (const t of state.tricks) {
            wins[t.winnerId] = (wins[t.winnerId] ?? 0) + 1;
        }
        const chienRevealed = state.phase === "dog" || state.phase === "done";

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
            lastTrick: state.lastTrick,
            result: state.result,
            self: viewerId,
            players: order.map((p): TarotPlayerView => {
                const slot: TarotPlayerView = {
                    playerId: p.id,
                    name: p.name,
                    handCount: state.hands[p.id].length,
                    isTaker: state.taker === p.id,
                    bid: state.bids[p.id] ?? null,
                    trickWins: wins[p.id] ?? 0,
                };
                return viewerId === p.id
                    ? { ...slot, hand: state.hands[p.id] }
                    : slot;
            }),
        };
    },
};

/**
 * Build a Tarot module bound to a rule set. Rules are stamped into the state at
 * deal time, so a saved game resumes/replays identically on any instance — pair
 * the persisted `state.rules` with the seed and the action log.
 */
export function createTarot(
    rules: TarotRules = DEFAULT_TAROT_RULES,
): GameModule<TarotState, TarotAction, TarotView> {
    return {
        ...base,
        withRules(chosen) {
            const pick = (key: keyof TarotRules): boolean =>
                chosen[key] ?? DEFAULT_TAROT_RULES[key];
            return createTarot({
                gardeSansContre: pick("gardeSansContre"),
                petitAuBout: pick("petitAuBout"),
                slam: pick("slam"),
            });
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

/** Default module — all table rules enabled. */
export const tarot = createTarot();
