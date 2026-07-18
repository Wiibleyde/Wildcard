import { DECKS } from "@/lib/card/decks";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { buildDeck } from "@/lib/engine/deck";
import type { Rng } from "@/lib/engine/rng";
import { fail, seatOrder } from "@/lib/engine/rules";
import type {
    ApplyResult,
    GameEvent,
    GameModule,
    Player,
} from "@/lib/engine/types";
import {
    buildRuleContext,
    firstMatchingRule,
    matchingRules,
    ruleHasEffect,
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
 * Turn an {@link EcaDefinition} (plain JSON authored in the Game Studio) into
 * a regular {@link GameModule}. Studio games and native TypeScript games run
 * through the SAME runner (`createGame` / `dispatch` / `replay`) — the ECA
 * engine is one more module, not a parallel code path.
 *
 * Semantics (v1):
 * - **cardPlayed** — on `playCard`, the `cardPlayed` rules are evaluated in
 *   array order; the FIRST rule whose conditions all pass fires. The play is
 *   legal iff that rule contains an `acceptCard` effect — otherwise (explicit
 *   `rejectCard`, a matching rule that never accepts, or no matching rule at
 *   all) the action is refused and the state is unchanged. When accepted, the
 *   card moves from the hand to the top of the discard, then the rule's other
 *   effects run in order.
 * - **turnStarted** — fires whenever a player's turn begins (after each
 *   advancement, including game start for the first player). ALL matching
 *   `turnStarted` rules fire in order, each re-evaluated against the state
 *   left by the previous one. A `skipNextPlayer` fired here skips the very
 *   turn that just began — the freshly started turn IS the "next" turn — and
 *   passes it onward, so a chain can form; it is capped at `players.length`
 *   iterations to guarantee termination.
 * - **Advancement order** after a play's effects: `endGame` fired ⇒ done;
 *   else empty actor hand ⇒ actor wins (v1 win condition); else `playAgain`
 *   ⇒ the actor keeps the turn (a fresh go — they may draw again; skips and
 *   direction changes stay recorded for the next advancement); else the turn
 *   advances by `direction` over seat order, consuming `pendingSkips`.
 * - **drawCard** — legal iff `turn.allowDraw`, not already drawn this turn,
 *   and at least one card is obtainable (draw pile, or reshuffle allowed with
 *   ≥ 2 discards). Draws one card; the turn does NOT advance.
 * - **pass** — legal iff `turn.allowPass` and (`!passRequiresDraw` ‖ already
 *   drawn ‖ drawing is impossible). Deadlock guard: a player with no legal
 *   play, no draw and no pass may always pass regardless of the flags.
 * - **Blocked game** — a full silent cycle (`consecutivePasses ≥ players`)
 *   while drawing cannot help (draws disabled, or no card obtainable even by
 *   reshuffle) ends the game; fewest cards wins (ties share rank 1).
 * - **Determinism** — the only randomness is `rng` (setup shuffle, discard
 *   reshuffle); `rng.state` is persisted into `rngState` after every apply,
 *   so a game replays exactly from `(definition, seed, action log)`.
 */

// ── Mutable working copy ─────────────────────────────────────────────────────

/**
 * Working draft of the mutable parts of a state during one `apply`. The
 * incoming state is never touched (copies made up front); the draft is
 * folded into a fresh immutable state by {@link finalize}.
 */
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

function makeDraft(state: EcaState): Draft {
    const hands: Record<string, CardDescriptor[]> = {};
    for (const [id, cards] of Object.entries(state.hands)) {
        hands[id] = [...cards];
    }
    return {
        hands,
        drawPile: [...state.drawPile],
        discardPile: [...state.discardPile],
        direction: state.direction,
        pendingSkips: state.pendingSkips,
        playAgain: false,
        ended: false,
        winnerIds: [...state.winnerIds],
        events: [],
    };
}

// ── Shared legality (single code path for legalActions AND apply) ────────────

function deckRanksOf(definition: EcaDefinition): readonly Rank[] {
    return DECKS[definition.setup.deckId].ranks;
}

/**
 * The rule that accepts `card` for `actorId`, or `null` when the play is
 * illegal. First-match-wins: only the first matching rule counts — a later
 * rule with an acceptCard cannot rescue a card the first matcher rejects.
 */
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

/** At least one card is obtainable by drawing (pile, or reshuffleable discard). */
function drawAvailable(state: EcaState): boolean {
    return (
        state.drawPile.length > 0 ||
        (state.definition.turn.reshuffleDiscard && state.discardPile.length > 1)
    );
}

function canDrawNow(state: EcaState): boolean {
    return (
        state.definition.turn.allowDraw &&
        !state.hasDrawnThisTurn &&
        drawAvailable(state)
    );
}

function canPassNow(state: EcaState, actorId: string): boolean {
    const { turn } = state.definition;
    // passRequiresDraw only applies when drawing is a feature at all.
    const requiresDraw = turn.passRequiresDraw && turn.allowDraw;
    if (
        turn.allowPass &&
        (!requiresDraw || state.hasDrawnThisTurn || !drawAvailable(state))
    ) {
        return true;
    }
    // Deadlock guard: nothing to play, nothing to draw, no pass allowed —
    // pass becomes legal anyway so the game can never soft-lock a player.
    const hand = state.hands[actorId] ?? [];
    const hasPlay = hand.some(
        (card) => acceptingRule(state, actorId, card) !== null,
    );
    return !hasPlay && !canDrawNow(state);
}

// ── Effects ──────────────────────────────────────────────────────────────────

/** Seat right after `fromId` in the current direction (ignores skips). */
function neighborOf(
    players: readonly Player[],
    fromId: string,
    direction: 1 | -1,
): string {
    const order = seatOrder(players);
    const index = order.findIndex((p) => p.id === fromId);
    return order[(index + direction + order.length) % order.length].id;
}

/**
 * Draw up to `count` cards into `targetId`'s hand. When the pile runs dry and
 * `reshuffleDiscard` is on, the discard minus its top is reshuffled into a new
 * pile (consuming rng — the caller persists `rng.state`). If cards still run
 * out, draws what is available.
 */
function drawInto(
    draft: Draft,
    targetId: string,
    count: number,
    definition: EcaDefinition,
    rng: Rng,
): void {
    let drawn = 0;
    for (let i = 0; i < count; i++) {
        if (
            draft.drawPile.length === 0 &&
            definition.turn.reshuffleDiscard &&
            draft.discardPile.length > 1
        ) {
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

/**
 * Run a fired rule's effects in order. `acceptCard`/`rejectCard` are legality
 * markers, resolved before this point — they mutate nothing here. `actorId`
 * is the player the rule fired for (the card player, or the player whose turn
 * started).
 */
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
                        : neighborOf(players, actorId, draft.direction);
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

// ── Turn flow ────────────────────────────────────────────────────────────────

/** Move one seat past `fromId`, consuming pendingSkips on the players passed. */
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

/**
 * Fire every matching turnStarted rule for `currentId`, in order. Each rule is
 * re-evaluated against the draft as left by the previous one (a rule's draw
 * can enable or disable the next rule's condition).
 */
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
        if (matchingRules([rule], "turnStarted", ctx).length === 0) continue;
        draft.events.push({
            type: "ruleFired",
            payload: { ruleId: rule.id, ruleName: rule.name },
        });
        applyEffects(draft, rule.effects, currentId, players, definition, rng);
    }
}

/**
 * A turn begins for `startId`: fire its turnStarted rules; if they skipped the
 * freshly started turn, pass it onward and fire again for the next player —
 * capped at `players.length` iterations so reverse/skip combinations can never
 * loop forever. Returns the player whose turn finally rests, or `null` when an
 * endGame effect ended the game mid-chain.
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
    return current;
}

/** Advance past `fromId`, then run the turnStarted chain for the new player. */
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

/**
 * Fold the draft into a fresh immutable state. `rngState` is ALWAYS taken from
 * the live rng: it equals the incoming cursor when no randomness was consumed
 * and the advanced cursor otherwise — the persistence invariant in one place.
 */
function finalize(
    state: EcaState,
    draft: Draft,
    currentPlayerId: string | null,
    hasDrawnThisTurn: boolean,
    consecutivePasses: number,
    rng: Rng,
): ApplyResult<EcaState> {
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
            turn: state.turn + 1,
            rngState: rng.state,
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

// ── Module factory ───────────────────────────────────────────────────────────

/**
 * Build a {@link GameModule} out of a validated definition. `moduleId` is the
 * registry identity (convention `eca:<uuid>`; the Studio sandbox uses
 * `eca:draft`). The definition is stamped into the state at setup, so `apply`
 * and `legalActions` read it from the STATE — any instance can resume or
 * replay a saved game (président's stamped-rules pattern).
 */
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
            // Stock: top = last element, and the next card drawn is the next
            // undealt card — hence the reverse.
            const drawPile = deck.slice(cursor).reverse();

            const draft: Draft = {
                hands,
                drawPile,
                discardPile,
                direction: 1,
                pendingSkips: 0,
                playAgain: false,
                ended: false,
                winnerIds: [],
                events: [],
            };
            // Game start counts as the first player's turn beginning — their
            // turnStarted rules fire (setup has no event channel; the events
            // are dropped, the state changes stand).
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
                    const key = cardKey(action.card);
                    const held = hand.findIndex((c) => cardKey(c) === key);
                    if (held === -1) {
                        return fail(
                            "illegal_card",
                            "Card is not in the player's hand.",
                        );
                    }
                    const rule = acceptingRule(
                        state,
                        action.playerId,
                        action.card,
                    );
                    if (rule === null) {
                        return fail(
                            "illegal_card",
                            "No rule accepts this card.",
                        );
                    }

                    const draft = makeDraft(state);
                    const card = hand[held];
                    draft.hands[action.playerId].splice(held, 1);
                    draft.discardPile.push(card);
                    draft.events.push({
                        type: "cardPlayed",
                        payload: { playerId: action.playerId, card },
                    });
                    draft.events.push({
                        type: "ruleFired",
                        payload: { ruleId: rule.id, ruleName: rule.name },
                    });
                    applyEffects(
                        draft,
                        rule.effects,
                        action.playerId,
                        state.players,
                        state.definition,
                        rng,
                    );

                    // endGame beats the win condition beats playAgain.
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
                    return finalize(state, draft, current, false, 0, rng);
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
                    // The turn does not advance — the player may still play
                    // or pass. Drawing breaks a pass streak.
                    return finalize(
                        state,
                        draft,
                        state.currentPlayerId,
                        true,
                        0,
                        rng,
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
                    const passes = state.consecutivePasses + 1;
                    // Blocked game: a full silent cycle while drawing cannot
                    // help — draws disabled, or no card obtainable (empty
                    // pile, no reshuffle). Rank by fewest cards, ties share
                    // the win. An empty pile alone is NOT enough: with draws
                    // disabled the pile never empties and the game would
                    // otherwise loop forever.
                    if (
                        passes >= state.players.length &&
                        (!state.definition.turn.allowDraw ||
                            !drawAvailable(state))
                    ) {
                        draft.ended = true;
                        const counts = seatOrder(state.players).map((p) => ({
                            id: p.id,
                            count: draft.hands[p.id].length,
                        }));
                        const fewest = Math.min(...counts.map((c) => c.count));
                        draft.winnerIds = counts
                            .filter((c) => c.count === fewest)
                            .map((c) => c.id);
                        return finalize(state, draft, null, false, passes, rng);
                    }
                    const current = completeAdvance(
                        draft,
                        state.players,
                        state.definition,
                        action.playerId,
                        rng,
                    );
                    return finalize(state, draft, current, false, passes, rng);
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

            const winners = [...state.winnerIds];
            const others = seatOrder(state.players)
                .map((p) => p.id)
                .filter((id) => !winners.includes(id))
                .map((id) => ({ id, count: state.hands[id].length }))
                .sort((a, b) => a.count - b.count);

            const rankings = winners.map((playerId) => ({
                playerId,
                rank: 1,
                score: state.hands[playerId].length,
            }));
            // Competition ranking below the winners: equal counts share a
            // rank, the next distinct count skips past the tied group.
            let previousCount = -1;
            let previousRank = 1;
            others.forEach((entry, index) => {
                const rank =
                    index > 0 && entry.count === previousCount
                        ? previousRank
                        : winners.length + index + 1;
                previousCount = entry.count;
                previousRank = rank;
                rankings.push({
                    playerId: entry.id,
                    rank,
                    score: entry.count,
                });
            });

            return { rankings, winners };
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
