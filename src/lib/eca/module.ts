import { DECKS } from "@/lib/card/decks";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { cardKey, isCardDescriptor } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import { fail, rankByScore, seatAfter, seatOrder } from "@/lib/engine/rules";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    Player,
} from "@/lib/engine/types";
import {
    buildRuleContext,
    firstMatchingRule,
    ruleHasEffect,
    ruleMatches,
    topOfDiscard,
} from "./interpreter";
import type {
    EcaAction,
    EcaDefinition,
    EcaEffect,
    EcaPlayerView,
    EcaRule,
    EcaState,
    EcaView,
} from "./types";

/**
 * Interprets an {@link EcaDefinition} as a regular {@link GameModule}: studio
 * games run through the same runner as native ones.
 *
 * - cardPlayed: the FIRST matching rule decides; the play is legal iff it
 *   accepts, then its other effects run in order.
 * - turnStarted: ALL matching rules fire, each against the state the previous
 *   one left; a skip fired here skips the turn that just began.
 * - after a play: endGame > empty hand wins > playAgain > advance.
 * - a full cycle of forced passes with no obtainable card, or
 *   {@link ECA_TURN_LIMIT} actions, ends the game on fewest cards.
 */

/** Every game must end: a valid definition can describe one that never converges. */
export const ECA_TURN_LIMIT = 1000;

interface Draft {
    hands: Record<string, CardDescriptor[]>;
    drawPile: CardDescriptor[];
    discardPile: CardDescriptor[];
    direction: 1 | -1;
    pendingSkips: number;
    playAgain: boolean;
    ended: boolean;
    winnerIds: string[];
    events: GameEvent[];
}

function emptyDraft(
    piles: Pick<Draft, "hands" | "drawPile" | "discardPile">,
): Draft {
    return {
        ...piles,
        direction: 1,
        pendingSkips: 0,
        playAgain: false,
        ended: false,
        winnerIds: [],
        events: [],
    };
}

function makeDraft(state: EcaState): Draft {
    const hands: Record<string, CardDescriptor[]> = {};
    for (const [id, cards] of Object.entries(state.hands)) {
        hands[id] = [...cards];
    }
    return {
        ...emptyDraft({
            hands,
            drawPile: [...state.drawPile],
            discardPile: [...state.discardPile],
        }),
        direction: state.direction,
        pendingSkips: state.pendingSkips,
        winnerIds: [...state.winnerIds],
    };
}

function deckRanksOf(definition: EcaDefinition): readonly Rank[] {
    return DECKS[definition.setup.deckId].ranks;
}

/** First match wins: a later accepting rule cannot rescue a card the first matcher refuses. */
function acceptingRule(
    state: EcaState,
    actorId: string,
    card: CardDescriptor,
): EcaRule | null {
    const ctx = buildRuleContext(
        state,
        actorId,
        card,
        deckRanksOf(state.definition),
    );
    const rule = firstMatchingRule(state.definition.rules, "cardPlayed", ctx);
    return rule !== null && ruleHasEffect(rule, "acceptCard") ? rule : null;
}

function canReshuffle(
    definition: EcaDefinition,
    piles: Pick<EcaState, "drawPile" | "discardPile">,
): boolean {
    return (
        piles.drawPile.length === 0 &&
        definition.turn.reshuffleDiscard &&
        piles.discardPile.length > 1
    );
}

function drawAvailable(state: EcaState): boolean {
    return state.drawPile.length > 0 || canReshuffle(state.definition, state);
}

function canDrawNow(state: EcaState): boolean {
    return (
        state.definition.turn.allowDraw &&
        !state.hasDrawnThisTurn &&
        drawAvailable(state)
    );
}

function hasPlayableCard(state: EcaState, actorId: string): boolean {
    return (state.hands[actorId] ?? []).some(
        (card) => acceptingRule(state, actorId, card) !== null,
    );
}

function canPassNow(state: EcaState, actorId: string): boolean {
    const { turn } = state.definition;
    const requiresDraw = turn.passRequiresDraw && turn.allowDraw;
    if (
        turn.allowPass &&
        (!requiresDraw || state.hasDrawnThisTurn || !drawAvailable(state))
    ) {
        return true;
    }
    // Deadlock guard: a player with no play, no draw and no pass may still pass.
    return !hasPlayableCard(state, actorId) && !canDrawNow(state);
}

/** Draws what is available; an empty pile reshuffles the discard minus its top. */
function drawInto(
    draft: Draft,
    targetId: string,
    count: number,
    definition: EcaDefinition,
    rng: Rng,
): void {
    let drawn = 0;
    for (let i = 0; i < count; i++) {
        if (canReshuffle(definition, draft)) {
            const top = draft.discardPile[draft.discardPile.length - 1];
            draft.drawPile = rng.shuffle(draft.discardPile.slice(0, -1));
            draft.discardPile = [top];
        }
        const card = draft.drawPile.pop();
        if (card === undefined) break;
        if (draft.hands[targetId] === undefined) draft.hands[targetId] = [];
        draft.hands[targetId].push(card);
        drawn++;
    }
    if (drawn > 0) {
        draft.events.push({
            type: "cardsDrawn",
            payload: { playerId: targetId, count: drawn },
        });
    }
}

function fireRule(
    draft: Draft,
    rule: EcaRule,
    actorId: string,
    players: readonly Player[],
    definition: EcaDefinition,
    rng: Rng,
): void {
    draft.events.push({
        type: "ruleFired",
        payload: { ruleId: rule.id, ruleName: rule.name },
    });
    applyEffects(draft, rule.effects, actorId, players, definition, rng);
}

/** accept/reject are legality markers resolved before this point. */
function applyEffects(
    draft: Draft,
    effects: readonly EcaEffect[],
    actorId: string,
    players: readonly Player[],
    definition: EcaDefinition,
    rng: Rng,
): void {
    for (const effect of effects) {
        if (draft.ended) return;
        switch (effect.type) {
            case "acceptCard":
            case "rejectCard":
                break;
            case "drawCards": {
                const targetId =
                    effect.target === "actor"
                        ? actorId
                        : (seatAfter(players, actorId, {
                              direction: draft.direction,
                          }) ?? actorId);
                drawInto(draft, targetId, effect.count, definition, rng);
                break;
            }
            case "skipNextPlayer":
                draft.pendingSkips += 1;
                break;
            case "reverseDirection":
                draft.direction = draft.direction === 1 ? -1 : 1;
                draft.events.push({ type: "directionReversed" });
                break;
            case "playAgain":
                draft.playAgain = true;
                break;
            case "endGame":
                draft.ended = true;
                draft.winnerIds = [actorId];
                break;
        }
    }
}

/** Seat order: ranking sorts stably, so ties stay in seat order. */
function handSizes(
    hands: Readonly<Record<string, readonly CardDescriptor[]>>,
    players: readonly Player[],
): { playerId: string; score: number }[] {
    return seatOrder(players).map((p) => ({
        playerId: p.id,
        score: hands[p.id]?.length ?? 0,
    }));
}

/** Ties share the win. */
function endByFewestCards(draft: Draft, players: readonly Player[]): void {
    draft.ended = true;
    const { winners } = rankByScore(handSizes(draft.hands, players), {
        higherIsBetter: false,
    });
    draft.winnerIds = [...winners];
}

/** One seat past `fromId`, consuming pendingSkips on the players passed. */
function advanceFrom(
    draft: Draft,
    order: readonly Player[],
    fromId: string,
): string {
    let index = order.findIndex((p) => p.id === fromId);
    const step = (): void => {
        index = (index + draft.direction + order.length) % order.length;
    };
    step();
    while (draft.pendingSkips > 0) {
        draft.pendingSkips -= 1;
        draft.events.push({
            type: "playerSkipped",
            payload: { playerId: order[index].id },
        });
        step();
    }
    return order[index].id;
}

/** Each rule is evaluated against the draft the previous one left. */
function fireTurnStarted(
    draft: Draft,
    players: readonly Player[],
    definition: EcaDefinition,
    currentId: string,
    rng: Rng,
): void {
    for (const rule of definition.rules) {
        if (draft.ended) return;
        if (rule.event !== "turnStarted") continue;
        const ctx = buildRuleContext(
            {
                hands: draft.hands,
                drawPile: draft.drawPile,
                discardPile: draft.discardPile,
            },
            currentId,
            null,
            deckRanksOf(definition),
        );
        if (ruleMatches(rule, ctx)) {
            fireRule(draft, rule, currentId, players, definition, rng);
        }
    }
}

/**
 * Fires turnStarted for `startId`, passing a skipped turn onward. Capped at one
 * lap so skip chains terminate (leftover skips are dropped). `null` = game ended.
 */
function runTurnChain(
    draft: Draft,
    players: readonly Player[],
    definition: EcaDefinition,
    startId: string,
    rng: Rng,
): string | null {
    const order = seatOrder(players);
    let current = startId;
    for (let i = 0; i < order.length; i++) {
        fireTurnStarted(draft, players, definition, current, rng);
        if (draft.ended) return null;
        if (draft.pendingSkips === 0) return current;
        draft.pendingSkips -= 1;
        draft.events.push({
            type: "playerSkipped",
            payload: { playerId: current },
        });
        current = advanceFrom(draft, order, current);
        draft.events.push({
            type: "turnAdvanced",
            payload: { playerId: current },
        });
    }
    draft.pendingSkips = 0;
    return current;
}

function completeAdvance(
    draft: Draft,
    players: readonly Player[],
    definition: EcaDefinition,
    fromId: string,
    rng: Rng,
): string | null {
    const current = advanceFrom(draft, seatOrder(players), fromId);
    draft.events.push({ type: "turnAdvanced", payload: { playerId: current } });
    return runTurnChain(draft, players, definition, current, rng);
}

/** `turn` and `rngState` are written back by the runner's `dispatch`. */
function finalize(
    state: EcaState,
    draft: Draft,
    currentPlayerId: string | null,
    hasDrawnThisTurn: boolean,
    consecutivePasses: number,
): ApplyResult<EcaState> {
    if (!draft.ended && state.turn + 1 >= ECA_TURN_LIMIT) {
        endByFewestCards(draft, state.players);
    }
    if (draft.ended) {
        draft.events.push({
            type: "gameEnded",
            payload: { winnerIds: draft.winnerIds },
        });
    }
    return {
        ok: true,
        state: {
            ...state,
            phase: draft.ended ? "done" : "playing",
            currentPlayerId: draft.ended ? null : currentPlayerId,
            hands: draft.hands,
            drawPile: draft.drawPile,
            discardPile: draft.discardPile,
            direction: draft.direction,
            pendingSkips: draft.pendingSkips,
            hasDrawnThisTurn,
            consecutivePasses,
            winnerIds: draft.winnerIds,
        },
        events: draft.events,
    };
}

/** `apply`/`legalActions` read the definition stamped in the state, not the closure. */
export function createEcaModule(
    definition: EcaDefinition,
    moduleId: string,
): GameModule<EcaState, EcaAction, EcaView> {
    return {
        id: moduleId,
        name: definition.meta.name,
        deck: DECKS[definition.setup.deckId],
        minPlayers: definition.meta.minPlayers,
        maxPlayers: definition.meta.maxPlayers,

        setup(players, rng, seed, gameId) {
            const order = seatOrder(players);
            const deck = rng.shuffle(buildDeck(DECKS[definition.setup.deckId]));

            const hands: Record<string, CardDescriptor[]> = {};
            for (const p of order) hands[p.id] = [];
            let cursor = 0;
            for (let i = 0; i < definition.setup.handSize; i++) {
                for (const p of order) {
                    hands[p.id].push(deck[cursor]);
                    cursor++;
                }
            }
            const discardPile: CardDescriptor[] = [];
            if (definition.setup.startDiscard) {
                discardPile.push(deck[cursor]);
                cursor++;
            }
            // Top = last element: reversed so the next draw is the next undealt card.
            const drawPile = deck.slice(cursor).reverse();

            const draft = emptyDraft({ hands, drawPile, discardPile });
            // The first turn begins at setup: its turnStarted rules fire (events dropped).
            const first = runTurnChain(
                draft,
                players,
                definition,
                order[0].id,
                rng,
            );

            return {
                gameId,
                players,
                phase: draft.ended ? "done" : "playing",
                currentPlayerId: draft.ended ? null : first,
                turn: 0,
                seed,
                rngState: rng.state,
                definition,
                hands: draft.hands,
                drawPile: draft.drawPile,
                discardPile: draft.discardPile,
                direction: draft.direction,
                pendingSkips: draft.pendingSkips,
                hasDrawnThisTurn: false,
                consecutivePasses: 0,
                winnerIds: draft.winnerIds,
            };
        },

        legalActions(state, playerId) {
            if (state.phase !== "playing") return [];
            if (playerId !== state.currentPlayerId) return [];

            const actions: EcaAction[] = [];
            for (const card of state.hands[playerId] ?? []) {
                if (acceptingRule(state, playerId, card) !== null) {
                    actions.push({ type: "playCard", playerId, card });
                }
            }
            if (canDrawNow(state)) {
                actions.push({ type: "drawCard", playerId });
            }
            if (canPassNow(state, playerId)) {
                actions.push({ type: "pass", playerId });
            }
            return actions;
        },

        apply(state, action, rng) {
            if (state.phase === "done") {
                return fail("game_over", "The game has already finished.");
            }
            if (action.playerId !== state.currentPlayerId) {
                return fail("not_your_turn", "It is not this player's turn.");
            }

            switch (action.type) {
                case "playCard": {
                    const hand = state.hands[action.playerId] ?? [];
                    const key = isCardDescriptor(action.card)
                        ? cardKey(action.card)
                        : null;
                    const held = hand.findIndex((c) => cardKey(c) === key);
                    if (held === -1) {
                        return fail(
                            "illegal_card",
                            "Card is not in the player's hand.",
                        );
                    }
                    // Only the held card is trusted from here, never the client's object.
                    const card = hand[held];
                    const rule = acceptingRule(state, action.playerId, card);
                    if (rule === null) {
                        return fail(
                            "illegal_card",
                            "No rule accepts this card.",
                        );
                    }

                    const draft = makeDraft(state);
                    draft.hands[action.playerId].splice(held, 1);
                    draft.discardPile.push(card);
                    draft.events.push({
                        type: "cardPlayed",
                        payload: { playerId: action.playerId, card },
                    });
                    fireRule(
                        draft,
                        rule,
                        action.playerId,
                        state.players,
                        state.definition,
                        rng,
                    );

                    if (
                        !draft.ended &&
                        draft.hands[action.playerId].length === 0
                    ) {
                        draft.ended = true;
                        draft.winnerIds = [action.playerId];
                    }
                    let current: string | null = action.playerId;
                    if (!draft.ended && !draft.playAgain) {
                        current = completeAdvance(
                            draft,
                            state.players,
                            state.definition,
                            action.playerId,
                            rng,
                        );
                    }
                    // playAgain is a fresh go: the actor may draw again.
                    return finalize(state, draft, current, false, 0);
                }

                case "drawCard": {
                    if (!canDrawNow(state)) {
                        return fail(
                            "cannot_draw",
                            "Drawing is not allowed right now.",
                        );
                    }
                    const draft = makeDraft(state);
                    drawInto(draft, action.playerId, 1, state.definition, rng);
                    // The turn does not advance; drawing breaks a pass streak.
                    return finalize(
                        state,
                        draft,
                        state.currentPlayerId,
                        true,
                        0,
                    );
                }

                case "pass": {
                    if (!canPassNow(state, action.playerId)) {
                        return fail(
                            "cannot_pass",
                            "Passing is not allowed right now.",
                        );
                    }
                    const draft = makeDraft(state);
                    // Only a forced pass counts toward a blocked game.
                    const passes = hasPlayableCard(state, action.playerId)
                        ? 0
                        : state.consecutivePasses + 1;
                    // With draws disabled the pile never empties: that case must end too.
                    if (
                        passes >= state.players.length &&
                        (!state.definition.turn.allowDraw ||
                            !drawAvailable(state))
                    ) {
                        endByFewestCards(draft, state.players);
                        return finalize(state, draft, null, false, passes);
                    }
                    const current = completeAdvance(
                        draft,
                        state.players,
                        state.definition,
                        action.playerId,
                        rng,
                    );
                    return finalize(state, draft, current, false, passes);
                }

                default:
                    return fail("unknown_action", "Unknown action type.");
            }
        },

        isOver(state) {
            return state.phase === "done";
        },

        outcome(state) {
            if (state.phase !== "done") return null;

            // Winners rank first even holding more cards (an endGame effect decides).
            const winners = [...state.winnerIds];
            const rankings = winners.map((playerId) => ({
                playerId,
                rank: 1,
                score: state.hands[playerId]?.length ?? 0,
            }));
            const others = rankByScore(
                handSizes(state.hands, state.players).filter(
                    (e) => !winners.includes(e.playerId),
                ),
                { higherIsBetter: false },
            ).rankings.map((r) => ({ ...r, rank: r.rank + winners.length }));
            return { rankings: [...rankings, ...others], winners };
        },

        view(state, viewerId) {
            const view: EcaView = {
                gameId: state.gameId,
                phase: state.phase,
                turn: state.turn,
                currentPlayerId: state.currentPlayerId,
                direction: state.direction,
                topDiscard: topOfDiscard(state.discardPile),
                discardCount: state.discardPile.length,
                drawPileCount: state.drawPile.length,
                hasDrawnThisTurn: state.hasDrawnThisTurn,
                winnerIds: state.winnerIds,
                definition: {
                    name: state.definition.meta.name,
                    rules: state.definition.rules.map((rule) => ({
                        id: rule.id,
                        name: rule.name,
                        event: rule.event,
                    })),
                },
                self: viewerId,
                players: seatOrder(state.players).map((p): EcaPlayerView => {
                    const slot: EcaPlayerView = {
                        id: p.id,
                        name: p.name,
                        seat: p.seat,
                        handCount: state.hands[p.id]?.length ?? 0,
                    };
                    return viewerId === p.id
                        ? { ...slot, hand: state.hands[p.id] }
                        : slot;
                }),
            };
            return view;
        },
    };
}
