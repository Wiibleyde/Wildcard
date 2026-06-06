import { french52 } from "@/lib/card/decks";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    GameState,
} from "@/lib/engine/types";

/**
 * Bataille (War) — the foundational two-player game.
 *
 * No decisions: the only action is `flip`, which resolves a whole round
 * server-side (including any war chain on a tie). This proves the engine can
 * model a *simultaneous, engine-driven* game — there is no "current player",
 * and the entire outcome is derived on the server from hidden piles.
 */

/** Ace-high ranking. The unused `C` (Cavalier) sits between J and Q.
 * Intentionally different from president.ts: here 2 is lowest, Ace is highest. */
const RANK_VALUE: Record<Rank, number> = {
    "2": 2,
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
};

/** Cards laid face-down by each player on a tie before the deciding flip. */
const WAR_STAKE = 3;

/** Hard cap on war iterations — the loser strictly loses ≥1 card per round, so
 *  a game can never reach this; it exists only as a defensive backstop. */
const MAX_WAR_STEPS = 64;

function cardValue(card: CardDescriptor): number {
    return card.type === "suited" ? RANK_VALUE[card.rank] : 0;
}

export interface BataillePiles {
    /** Face-down stock — the top card is the LAST element. */
    readonly draw: readonly CardDescriptor[];
    /** Cards won this game; recycled (shuffled) into `draw` when it empties. */
    readonly won: readonly CardDescriptor[];
}

export interface BatailleState extends GameState {
    readonly phase: "reveal" | "done";
    readonly piles: Readonly<Record<string, BataillePiles>>;
    /** Face-up cards each player flipped in the last round (public). */
    readonly lastReveal: Readonly<Record<string, readonly CardDescriptor[]>>;
    /** Winner of the last round, or `null` on the opening state / drawn round. */
    readonly lastWinner: string | null;
    /** Rounds resolved so far. */
    readonly rounds: number;
}

export type BatailleAction = {
    readonly type: "flip";
    readonly playerId: string;
};

/** One player's slice of the public, redacted view. */
export interface BataillePlayerView {
    readonly playerId: string;
    readonly name: string;
    readonly drawCount: number;
    readonly wonCount: number;
    /** Cards still in play for this player. */
    readonly total: number;
    /** Their face-up cards from the last round (public). */
    readonly lastReveal: readonly CardDescriptor[];
}

export interface BatailleView {
    readonly gameId: string;
    readonly phase: BatailleState["phase"];
    readonly turn: number;
    readonly players: readonly BataillePlayerView[];
    readonly lastWinner: string | null;
    /** The viewer this projection was built for (`null` = spectator). */
    readonly self: string | null;
}

function totalCards(pile: BataillePiles): number {
    return pile.draw.length + pile.won.length;
}

/**
 * Take the top card, recycling the won pile (shuffled) back into draw when the
 * stock is empty. Returns `null` only when the player is completely out.
 */
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

/** Lay up to `n` cards face-down into the pot (fewer if the player runs low). */
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

/**
 * Resolve a full round between the two players: flip, compare, and recurse
 * through any war on a tie. All face-down war stakes stay hidden; only the
 * flipped cards land in `lastReveal`.
 */
function resolveRound(state: BatailleState, rng: Rng): BatailleState {
    const [a, b] = state.players;
    let pileA = state.piles[a.id];
    let pileB = state.piles[b.id];

    const revealA: CardDescriptor[] = [];
    const revealB: CardDescriptor[] = [];
    const pot: CardDescriptor[] = [];
    let winnerId: string | null = null;

    for (let step = 0; step < MAX_WAR_STEPS; step++) {
        const drawnA = drawTop(pileA, rng);
        const drawnB = drawTop(pileB, rng);

        // Out-of-cards: a player who cannot flip loses the round outright.
        if (!drawnA && !drawnB) break; // mutual exhaustion → drawn round
        if (!drawnA) {
            winnerId = b.id;
            // drawnB is non-null here (mutual exhaustion was caught above), guard needed for TypeScript
            if (drawnB) {
                pileB = drawnB.pile;
                pot.push(drawnB.card);
                revealB.push(drawnB.card);
            }
            break;
        }
        if (!drawnB) {
            winnerId = a.id;
            pileA = drawnA.pile;
            pot.push(drawnA.card);
            revealA.push(drawnA.card);
            break;
        }

        pileA = drawnA.pile;
        pileB = drawnB.pile;
        pot.push(drawnA.card, drawnB.card);
        revealA.push(drawnA.card);
        revealB.push(drawnB.card);

        const valueA = cardValue(drawnA.card);
        const valueB = cardValue(drawnB.card);
        if (valueA > valueB) {
            winnerId = a.id;
            break;
        }
        if (valueB > valueA) {
            winnerId = b.id;
            break;
        }

        // Tie → war: both lay face-down stakes, then the loop flips again.
        const stakeA = stakeFaceDown(pileA, rng, WAR_STAKE);
        pileA = stakeA.pile;
        pot.push(...stakeA.cards);
        const stakeB = stakeFaceDown(pileB, rng, WAR_STAKE);
        pileB = stakeB.pile;
        pot.push(...stakeB.cards);
    }

    const piles: Record<string, BataillePiles> = {
        [a.id]: pileA,
        [b.id]: pileB,
    };

    if (winnerId) {
        const w = piles[winnerId];
        // Shuffle the pot in so the won pile never forms a deterministic cycle.
        piles[winnerId] = {
            draw: w.draw,
            won: [...w.won, ...rng.shuffle(pot)],
        };
    } else if (pot.length > 0) {
        // Drawn round (mutual exhaustion mid-war): split the pot evenly.
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
    const over = totalCards(piles[a.id]) === 0 || totalCards(piles[b.id]) === 0;

    return {
        ...state,
        piles,
        lastReveal: { [a.id]: revealA, [b.id]: revealB },
        lastWinner: winnerId,
        rounds,
        turn: state.turn + 1,
        phase: over ? "done" : "reveal",
        rngState: rng.state,
    };
}

function fail(code: string, message: string): ApplyResult<BatailleState> {
    return { ok: false, error: { code, message } };
}

export const bataille: GameModule<BatailleState, BatailleAction, BatailleView> =
    {
        id: "bataille",
        name: "Bataille",
        deck: french52,
        minPlayers: 2,
        maxPlayers: 2,

        setup(players, rng, seed) {
            const [p0, p1] = players;
            const deck = rng.shuffle(buildDeck(french52));
            const half = Math.floor(deck.length / 2);
            return {
                gameId: crypto.randomUUID(),
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
            };
        },

        legalActions(state, playerId) {
            if (state.phase === "done") return [];
            if (!Object.hasOwn(state.piles, playerId)) return [];
            // Either seated player may trigger the shared round resolution.
            return [{ type: "flip", playerId }];
        },

        apply(state, action, rng) {
            if (state.phase === "done") {
                return fail("game_over", "The game has already finished.");
            }
            if (action.type !== "flip") {
                return fail(
                    "illegal_action",
                    `Unknown action "${action.type}".`,
                );
            }
            if (!Object.hasOwn(state.piles, action.playerId)) {
                return fail(
                    "not_a_player",
                    "Actor is not seated in this game.",
                );
            }

            const next = resolveRound(state, rng);
            const events: GameEvent[] = [
                {
                    type: "round_resolved",
                    payload: { winner: next.lastWinner, round: next.rounds },
                },
            ];
            if (next.phase === "done") {
                events.push({ type: "game_over" });
            }
            return { ok: true, state: next, events };
        },

        isOver(state) {
            return state.phase === "done";
        },

        outcome(state) {
            if (state.phase !== "done") return null;

            const scored = state.players
                .map((p) => ({
                    playerId: p.id,
                    score: totalCards(state.piles[p.id]),
                }))
                .sort((x, y) => y.score - x.score);

            let rank = 0;
            let previous = Number.POSITIVE_INFINITY;
            const rankings = scored.map((s, index) => {
                if (s.score < previous) {
                    rank = index + 1;
                    previous = s.score;
                }
                return { playerId: s.playerId, rank, score: s.score };
            });

            const best = scored[0].score;
            const winners = scored
                .filter((s) => s.score === best)
                .map((s) => s.playerId);

            return { rankings, winners };
        },

        view(state, viewerId) {
            return {
                gameId: state.gameId,
                phase: state.phase,
                turn: state.turn,
                lastWinner: state.lastWinner,
                self: viewerId,
                players: state.players.map((p) => {
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
