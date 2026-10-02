import { french52 } from "@/lib/card/decks";
import { buildRankOrder, rankOf } from "@/lib/card/rank";
import type { CardDescriptor } from "@/lib/card/types";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import {
    bindRules,
    defineRules,
    fail,
    rankByScore,
    seatOrder,
} from "@/lib/engine/rules";
import type {
    GameEvent,
    GameModule,
    GameRuleMode,
    GameState,
} from "@/lib/engine/types";

/*
 * Bataille (War) — the engine's simultaneous, engine-driven proof: no current
 * player, a single `flip` resolves a whole round (wars included) server-side
 * from hidden piles. French rules: a tie stakes one face-down card; the
 * English variant (`threeCardWar`) stakes three. Capped at MAX_ROUNDS, then
 * decided on card count.
 */

const RANK_VALUE = buildRankOrder([
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
    "A",
]);

export const WAR_STAKE = 1;
const ENGLISH_WAR_STAKE = 3;

interface BatailleRules {
    readonly threeCardWar: boolean;
}

const DEFAULT_BATAILLE_RULES: BatailleRules = { threeCardWar: false };

const BATAILLE_RULE_MODES: readonly GameRuleMode[] = [
    { key: "bataille_fr", rules: { threeCardWar: false } },
    { key: "bataille_war", rules: { threeCardWar: true } },
];

/** Defensive bound only: each war step burns ≥ 2 cards per player. */
const MAX_WAR_STEPS = 64;

/** Real games have run past 1 000 rounds; the cap keeps a match finite. */
export const MAX_ROUNDS = 1000;

function cardValue(card: CardDescriptor): number {
    const rank = rankOf(card);
    return rank === null ? 0 : RANK_VALUE[rank];
}

interface BataillePiles {
    /** Top card is the LAST element. */
    readonly draw: readonly CardDescriptor[];
    /** Recycled (shuffled) into `draw` when it empties. */
    readonly won: readonly CardDescriptor[];
}

export interface BatailleState extends GameState {
    readonly phase: "reveal" | "done";
    readonly piles: Readonly<Record<string, BataillePiles>>;
    /** Face-up cards of the last round (public). */
    readonly lastReveal: Readonly<Record<string, readonly CardDescriptor[]>>;
    /** `null` on the opening state and after a drawn round. */
    readonly lastWinner: string | null;
    /** Equal to `turn`; kept because persisted states carry it (replay compares states). */
    readonly rounds: number;
    /** Absent on games recorded before rules existed (= French rules). */
    readonly rules?: BatailleRules;
}

export type BatailleAction = {
    readonly type: "flip";
    readonly playerId: string;
};

interface BataillePlayerView {
    readonly playerId: string;
    readonly name: string;
    readonly drawCount: number;
    readonly wonCount: number;
    readonly total: number;
    readonly lastReveal: readonly CardDescriptor[];
}

export interface BatailleView {
    readonly gameId: string;
    readonly phase: BatailleState["phase"];
    readonly turn: number;
    readonly players: readonly BataillePlayerView[];
    readonly lastWinner: string | null;
    readonly self: string | null;
}

function totalCards(pile: BataillePiles): number {
    return pile.draw.length + pile.won.length;
}

/** `null` only when the player is completely out of cards. */
function drawTop(
    pile: BataillePiles,
    rng: Rng,
): { card: CardDescriptor; pile: BataillePiles } | null {
    let { draw, won } = pile;
    if (draw.length === 0) {
        if (won.length === 0) return null;
        draw = rng.shuffle(won);
        won = [];
    }
    const card = draw[draw.length - 1];
    return { card, pile: { draw: draw.slice(0, -1), won } };
}

function stakeFaceDown(
    pile: BataillePiles,
    rng: Rng,
    n: number,
): { cards: CardDescriptor[]; pile: BataillePiles } {
    const cards: CardDescriptor[] = [];
    let current = pile;
    for (let i = 0; i < n; i++) {
        const drawn = drawTop(current, rng);
        if (!drawn) break;
        cards.push(drawn.card);
        current = drawn.pile;
    }
    return { cards, pile: current };
}

/** Flip, compare, and chain wars on ties. Stakes stay hidden; only flips are revealed. */
function resolveRound(state: BatailleState, rng: Rng): BatailleState {
    const [a, b] = state.players;
    let pileA = state.piles[a.id];
    let pileB = state.piles[b.id];
    const stake = state.rules?.threeCardWar ? ENGLISH_WAR_STAKE : WAR_STAKE;

    const revealA: CardDescriptor[] = [];
    const revealB: CardDescriptor[] = [];
    const pot: CardDescriptor[] = [];
    let winnerId: string | null = null;

    for (let step = 0; step < MAX_WAR_STEPS; step++) {
        const drawnA = drawTop(pileA, rng);
        const drawnB = drawTop(pileB, rng);

        // A player who cannot flip loses the round; both out ⇒ drawn round.
        if (!drawnA || !drawnB) {
            if (drawnA) {
                winnerId = a.id;
                pileA = drawnA.pile;
                pot.push(drawnA.card);
                revealA.push(drawnA.card);
            } else if (drawnB) {
                winnerId = b.id;
                pileB = drawnB.pile;
                pot.push(drawnB.card);
                revealB.push(drawnB.card);
            }
            break;
        }

        pileA = drawnA.pile;
        pileB = drawnB.pile;
        pot.push(drawnA.card, drawnB.card);
        revealA.push(drawnA.card);
        revealB.push(drawnB.card);

        const valueA = cardValue(drawnA.card);
        const valueB = cardValue(drawnB.card);
        if (valueA !== valueB) {
            winnerId = valueA > valueB ? a.id : b.id;
            break;
        }

        const stakeA = stakeFaceDown(pileA, rng, stake);
        pileA = stakeA.pile;
        pot.push(...stakeA.cards);
        const stakeB = stakeFaceDown(pileB, rng, stake);
        pileB = stakeB.pile;
        pot.push(...stakeB.cards);
    }

    const piles: Record<string, BataillePiles> = {
        [a.id]: pileA,
        [b.id]: pileB,
    };

    if (winnerId) {
        const w = piles[winnerId];
        // Shuffled in so the won pile never settles into a deterministic cycle.
        piles[winnerId] = {
            draw: w.draw,
            won: [...w.won, ...rng.shuffle(pot)],
        };
    } else if (pot.length > 0) {
        const shuffled = rng.shuffle(pot);
        const mid = Math.floor(shuffled.length / 2);
        piles[a.id] = {
            ...piles[a.id],
            won: [...piles[a.id].won, ...shuffled.slice(0, mid)],
        };
        piles[b.id] = {
            ...piles[b.id],
            won: [...piles[b.id].won, ...shuffled.slice(mid)],
        };
    }

    const rounds = state.rounds + 1;
    const over =
        totalCards(piles[a.id]) === 0 ||
        totalCards(piles[b.id]) === 0 ||
        rounds >= MAX_ROUNDS;

    return {
        ...state,
        piles,
        lastReveal: { [a.id]: revealA, [b.id]: revealB },
        lastWinner: winnerId,
        rounds,
        phase: over ? "done" : "reveal",
    };
}

const base: Omit<
    GameModule<BatailleState, BatailleAction, BatailleView>,
    "setup"
> = {
    id: "bataille",
    name: "Bataille",
    deck: french52,
    minPlayers: 2,
    maxPlayers: 2,
    ruleToggles: defineRules(DEFAULT_BATAILLE_RULES),
    ruleModes: BATAILLE_RULE_MODES,

    legalActions(state, playerId) {
        if (state.phase === "done") return [];
        if (!Object.hasOwn(state.piles, playerId)) return [];
        // Either seated player may trigger the shared round.
        return [{ type: "flip", playerId }];
    },

    apply(state, action, rng) {
        if (action.type !== "flip") {
            return fail("illegal_action", `Unknown action "${action.type}".`);
        }

        const next = resolveRound(state, rng);
        const events: GameEvent[] = [
            {
                type: "round_resolved",
                payload: { winner: next.lastWinner, round: next.rounds },
            },
        ];
        if (next.phase === "done") {
            if (next.players.every((p) => totalCards(next.piles[p.id]) > 0)) {
                events.push({
                    type: "round_limit",
                    payload: { rounds: next.rounds },
                });
            }
            events.push({ type: "game_over" });
        }
        return { ok: true, state: next, events };
    },

    isOver(state) {
        return state.phase === "done";
    },

    outcome(state) {
        if (state.phase !== "done") return null;
        return rankByScore(
            state.players.map((p) => ({
                playerId: p.id,
                score: totalCards(state.piles[p.id]),
            })),
            { higherIsBetter: true },
        );
    },

    view(state, viewerId) {
        return {
            gameId: state.gameId,
            phase: state.phase,
            turn: state.turn,
            lastWinner: state.lastWinner,
            self: viewerId,
            players: seatOrder(state.players).map((p) => {
                const pile = state.piles[p.id];
                return {
                    playerId: p.id,
                    name: p.name,
                    drawCount: pile.draw.length,
                    wonCount: pile.won.length,
                    total: totalCards(pile),
                    lastReveal: state.lastReveal[p.id] ?? [],
                };
            }),
        };
    },
};

/**
 * The unbound module stamps no rules — exactly how games recorded before
 * rules existed were dealt, so their replays still match.
 */
function createBataille(
    rules?: BatailleRules,
): GameModule<BatailleState, BatailleAction, BatailleView> {
    return {
        ...base,
        withRules(chosen) {
            return createBataille(bindRules(chosen, DEFAULT_BATAILLE_RULES));
        },
        setup(players, rng, seed, gameId) {
            const [p0, p1] = players;
            const deck = rng.shuffle(buildDeck(french52));
            const half = Math.floor(deck.length / 2);
            return {
                gameId,
                players,
                phase: "reveal",
                currentPlayerId: null,
                turn: 0,
                seed,
                rngState: rng.state,
                piles: {
                    [p0.id]: { draw: deck.slice(0, half), won: [] },
                    [p1.id]: { draw: deck.slice(half), won: [] },
                },
                lastReveal: { [p0.id]: [], [p1.id]: [] },
                lastWinner: null,
                rounds: 0,
                ...(rules ? { rules } : {}),
            };
        },
    };
}

export const bataille = createBataille();
