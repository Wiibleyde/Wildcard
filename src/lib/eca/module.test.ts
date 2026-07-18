import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { clientState, createGame, dispatch, replay } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import { CRAZY_EIGHTS_LIKE, MINIMAL_VALID } from "./fixtures";
import { createEcaModule } from "./module";
import type {
    EcaAction,
    EcaCondition,
    EcaDefinition,
    EcaRule,
    EcaState,
} from "./types";
import { validateEcaDefinition } from "./validate";

const P3: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
    { id: "c", name: "C", seat: 2 },
];
const P2: Player[] = P3.slice(0, 2);

function card(rank: Rank, suit: Suit = "spades"): CardDescriptor {
    return { type: "suited", suit, rank };
}

const rankIs = (rank: string): EcaCondition => ({
    lhs: { kind: "card", source: "playedCard", prop: "rank" },
    op: "eq",
    rhs: { kind: "literal", value: rank },
});

const acceptAll: EcaRule = {
    id: "accept-all",
    name: "Tout passe",
    event: "cardPlayed",
    conditions: [],
    effects: [{ type: "acceptCard" }],
};

/** K feeds the next player, Q replays, J ends the game — else anything goes. */
const SPECIALS: EcaDefinition = {
    ...MINIMAL_VALID,
    rules: [
        {
            id: "king-feeds",
            name: "Roi — le suivant pioche 2",
            event: "cardPlayed",
            conditions: [rankIs("K")],
            effects: [
                { type: "acceptCard" },
                { type: "drawCards", target: "nextPlayer", count: 2 },
            ],
        },
        {
            id: "queen-again",
            name: "Dame — rejoue",
            event: "cardPlayed",
            conditions: [rankIs("Q")],
            effects: [{ type: "acceptCard" }, { type: "playAgain" }],
        },
        {
            id: "jack-ends",
            name: "Valet — fin de partie",
            event: "cardPlayed",
            conditions: [rankIs("J")],
            effects: [
                { type: "acceptCard" },
                { type: "endGame", winner: "actor" },
            ],
        },
        acceptAll,
    ],
};

/** An early reject shadows the accept-all below it (first match wins). */
const REJECT_SEVENS: EcaDefinition = {
    ...MINIMAL_VALID,
    rules: [
        {
            id: "no-sevens",
            name: "Pas de 7",
            event: "cardPlayed",
            conditions: [rankIs("7")],
            effects: [{ type: "rejectCard" }],
        },
        acceptAll,
    ],
};

/** Only kings are playable — passing is the only way out. */
const KINGS_ONLY: EcaDefinition = {
    ...MINIMAL_VALID,
    turn: {
        allowDraw: false,
        allowPass: true,
        passRequiresDraw: false,
        reshuffleDiscard: false,
    },
    rules: [
        {
            id: "kings-only",
            name: "Rois seulement",
            event: "cardPlayed",
            conditions: [rankIs("K")],
            effects: [{ type: "acceptCard" }],
        },
    ],
};

/** Kings only AND no pass/draw at all — exercises the deadlock guard. */
const KINGS_NO_PASS: EcaDefinition = {
    ...KINGS_ONLY,
    turn: { ...KINGS_ONLY.turn, allowPass: false },
};

const TURN_DRAW: EcaDefinition = {
    ...MINIMAL_VALID,
    rules: [
        acceptAll,
        {
            id: "turn-draw",
            name: "Pioche d'office",
            event: "turnStarted",
            conditions: [],
            effects: [{ type: "drawCards", target: "actor", count: 1 }],
        },
    ],
};

const TURN_SKIP: EcaDefinition = {
    ...MINIMAL_VALID,
    rules: [
        acceptAll,
        {
            id: "turn-skip",
            name: "Tour toujours sauté",
            event: "turnStarted",
            conditions: [],
            effects: [{ type: "skipNextPlayer" }],
        },
    ],
};

const TURN_END: EcaDefinition = {
    ...MINIMAL_VALID,
    rules: [
        acceptAll,
        {
            id: "turn-end",
            name: "Main courte gagne",
            event: "turnStarted",
            conditions: [
                {
                    lhs: { kind: "stat", source: "actorHandCount" },
                    op: "lte",
                    rhs: { kind: "literal", value: 1 },
                },
            ],
            effects: [{ type: "endGame", winner: "actor" }],
        },
    ],
};

const crazy = createEcaModule(CRAZY_EIGHTS_LIKE, "eca:crazy");
const minimal = createEcaModule(MINIMAL_VALID, "eca:minimal");
const specials = createEcaModule(SPECIALS, "eca:specials");

/** Every test definition must itself survive the validator. */
it("test definitions are valid ECA documents", () => {
    for (const def of [
        SPECIALS,
        REJECT_SEVENS,
        KINGS_ONLY,
        KINGS_NO_PASS,
        TURN_DRAW,
        TURN_SKIP,
        TURN_END,
    ]) {
        expect(validateEcaDefinition(def).ok).toBe(true);
    }
});

/** Hand-crafted mid-game state (président test pattern). */
function stateWith(
    definition: EcaDefinition,
    hands: Record<string, readonly CardDescriptor[]>,
    overrides: Partial<EcaState> = {},
): EcaState {
    return {
        gameId: "test",
        players: P3,
        phase: "playing",
        currentPlayerId: "a",
        turn: 0,
        seed: 0,
        rngState: 1,
        definition,
        hands,
        drawPile: [],
        discardPile: [],
        direction: 1,
        pendingSkips: 0,
        hasDrawnThisTurn: false,
        consecutivePasses: 0,
        winnerIds: [],
        ...overrides,
    };
}

type EcaModule = ReturnType<typeof createEcaModule>;

/** Route through the runner (supplies rng + identity check). */
function step(
    module: EcaModule,
    s: EcaState,
    action: EcaAction,
): ReturnType<typeof dispatch<EcaState, EcaAction, unknown>> {
    return dispatch(module, s, action, action.playerId);
}

function ok(module: EcaModule, s: EcaState, action: EcaAction): EcaState {
    const res = step(module, s, action);
    if (!res.ok) throw new Error(`unexpected refusal: ${res.error.code}`);
    return res.state;
}

const play = (id: string, c: CardDescriptor): EcaAction => ({
    type: "playCard",
    playerId: id,
    card: c,
});
const draw = (id: string): EcaAction => ({ type: "drawCard", playerId: id });
const pass = (id: string): EcaAction => ({ type: "pass", playerId: id });

describe("eca module surface", () => {
    it("exposes id, name, deck and player bounds from the definition", () => {
        expect(crazy.id).toBe("eca:crazy");
        expect(crazy.name).toBe("Huit américain");
        expect(crazy.deck.id).toBe("french52");
        expect(crazy.minPlayers).toBe(2);
        expect(crazy.maxPlayers).toBe(5);
        expect(minimal.deck.id).toBe("french32");
    });
});

describe("eca setup", () => {
    it("deals handSize cards each, flips a start discard, stocks the rest", () => {
        const s = createGame(crazy, P3, 1234);
        for (const p of P3) expect(s.hands[p.id]).toHaveLength(7);
        expect(s.discardPile).toHaveLength(1);
        expect(s.drawPile).toHaveLength(52 - 3 * 7 - 1);
        const all = [
            ...P3.flatMap((p) => s.hands[p.id]),
            ...s.drawPile,
            ...s.discardPile,
        ].map(cardKey);
        expect(new Set(all).size).toBe(52); // nothing lost, nothing doubled
        expect(s.currentPlayerId).toBe("a"); // seat 0 opens
        expect(s.phase).toBe("playing");
    });

    it("skips the start discard when the definition says so", () => {
        const s = createGame(minimal, P2, 42);
        expect(s.discardPile).toHaveLength(0);
        expect(s.drawPile).toHaveLength(32 - 2 * 5);
    });

    it("is deterministic for a fixed seed", () => {
        const a = createGame(crazy, P3, 99, "g");
        const b = createGame(crazy, P3, 99, "g");
        expect(a).toEqual(b);
    });

    it("fires turnStarted rules for the opening player", () => {
        const module = createEcaModule(TURN_DRAW, "eca:turn-draw");
        const s = createGame(module, P3, 7);
        expect(s.hands.a).toHaveLength(6); // 5 dealt + 1 drawn at turn start
        expect(s.hands.b).toHaveLength(5);
        expect(s.drawPile).toHaveLength(32 - 15 - 1);
    });
});

describe("eca play legality (through the runner)", () => {
    const board = (): EcaState =>
        stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [card("5", "hearts"), card("2", "clubs")],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            {
                discardPile: [card("9", "hearts")],
                drawPile: [card("3", "clubs"), card("4", "clubs")],
            },
        );

    it("accepts a suit match and advances the turn", () => {
        const res = step(crazy, board(), play("a", card("5", "hearts")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.discardPile.at(-1)).toEqual(card("5", "hearts"));
        expect(res.state.hands.a).toEqual([card("2", "clubs")]);
        expect(res.state.currentPlayerId).toBe("b");
        expect(res.state.consecutivePasses).toBe(0);
        // rng untouched by a plain play — the cursor passes through unchanged.
        expect(res.state.rngState).toBe(1);
        expect(res.events).toContainEqual({
            type: "ruleFired",
            payload: { ruleId: "same-suit", ruleName: "Même couleur" },
        });
        expect(res.events).toContainEqual({
            type: "cardPlayed",
            payload: { playerId: "a", card: card("5", "hearts") },
        });
        expect(res.events).toContainEqual({
            type: "turnAdvanced",
            payload: { playerId: "b" },
        });
    });

    it("rejects a card no rule accepts", () => {
        const res = step(crazy, board(), play("a", card("2", "clubs")));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("illegal_card");
    });

    it("rejects a card the player does not hold", () => {
        const res = step(crazy, board(), play("a", card("K", "hearts")));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("illegal_card");
    });

    it("rejects acting out of turn", () => {
        const res = step(crazy, board(), play("b", card("9", "spades")));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("not_your_turn");
    });

    it("rejects an unknown action type", () => {
        const res = step(
            minimal,
            stateWith(MINIMAL_VALID, { a: [card("7")] }),
            {
                type: "cheat",
                playerId: "a",
            } as unknown as EcaAction,
        );
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("unknown_action");
    });
});

describe("eca first-match-wins ordering", () => {
    it("an early rejectCard shadows a later accept-all", () => {
        const module = createEcaModule(REJECT_SEVENS, "eca:reject-sevens");
        const s = stateWith(REJECT_SEVENS, {
            a: [card("7"), card("8")],
            b: [card("9")],
            c: [card("10")],
        });
        const refused = step(module, s, play("a", card("7")));
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.error.code).toBe("illegal_card");
        expect(step(module, s, play("a", card("8"))).ok).toBe(true);
        // legalActions agrees: only the 8 is offered (no draw/pass, a play exists).
        expect(module.legalActions(s, "a")).toEqual([play("a", card("8"))]);
    });

    it("an early special rule shadows the plain suit rule below it", () => {
        const s = stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [card("7", "hearts"), card("3", "hearts")],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            { discardPile: [card("9", "hearts")] },
        );
        const res = step(crazy, s, play("a", card("7", "hearts")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.events).toContainEqual({
            type: "ruleFired",
            payload: {
                ruleId: "seven-suit-skips",
                ruleName: "7 (couleur) — saute le suivant",
            },
        });
        // …and its skip effect fired: b is skipped, c plays.
        expect(res.events).toContainEqual({
            type: "playerSkipped",
            payload: { playerId: "b" },
        });
        expect(res.state.currentPlayerId).toBe("c");
        expect(res.state.pendingSkips).toBe(0);
    });
});

describe("eca effects", () => {
    it("reverseDirection: an ace turns the rotation around", () => {
        const s = stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [card("A", "hearts"), card("3", "clubs")],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            { discardPile: [card("9", "hearts")] },
        );
        const res = step(crazy, s, play("a", card("A", "hearts")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.direction).toBe(-1);
        expect(res.state.currentPlayerId).toBe("c"); // backwards from a
        expect(res.events).toContainEqual({ type: "directionReversed" });
    });

    it("drawCards nextPlayer: a king feeds two cards to the neighbour", () => {
        const s = stateWith(
            SPECIALS,
            {
                a: [card("K"), card("8")],
                b: [card("9")],
                c: [card("10")],
            },
            {
                drawPile: [
                    card("7", "clubs"),
                    card("8", "clubs"),
                    card("9", "clubs"),
                ],
            },
        );
        const res = step(specials, s, play("a", card("K")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.hands.b).toHaveLength(3);
        expect(res.state.drawPile).toHaveLength(1);
        expect(res.events).toContainEqual({
            type: "cardsDrawn",
            payload: { playerId: "b", count: 2 },
        });
        expect(res.state.currentPlayerId).toBe("b"); // still their turn
    });

    it("drawCards draws what is available when the stock runs short", () => {
        const s = stateWith(
            SPECIALS,
            { a: [card("K"), card("8")], b: [card("9")], c: [card("10")] },
            { drawPile: [card("7", "clubs")] }, // 1 card, no reshuffle
        );
        const res = step(specials, s, play("a", card("K")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.hands.b).toHaveLength(2);
        expect(res.state.drawPile).toHaveLength(0);
        expect(res.events).toContainEqual({
            type: "cardsDrawn",
            payload: { playerId: "b", count: 1 },
        });
    });

    it("playAgain: the actor keeps the turn and can play again", () => {
        const s = stateWith(SPECIALS, {
            a: [card("Q"), card("8")],
            b: [card("9")],
            c: [card("10")],
        });
        const res = step(specials, s, play("a", card("Q")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.currentPlayerId).toBe("a");
        expect(res.events.some((e) => e.type === "turnAdvanced")).toBe(false);
        // The follow-up play is a's to make.
        expect(step(specials, res.state, play("a", card("8"))).ok).toBe(true);
    });

    it("endGame: a jack ends the game with the actor as winner", () => {
        const s = stateWith(SPECIALS, {
            a: [card("J"), card("8")],
            b: [card("9")],
            c: [card("10"), card("A")],
        });
        const res = step(specials, s, play("a", card("J")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("done");
        expect(res.state.currentPlayerId).toBeNull();
        expect(res.state.winnerIds).toEqual(["a"]);
        expect(res.events).toContainEqual({
            type: "gameEnded",
            payload: { winnerIds: ["a"] },
        });
        expect(specials.isOver(res.state)).toBe(true);
        // b holds 1 card (rank 2), c holds 2 (rank 3) — a won by decree with 1 left.
        expect(specials.outcome(res.state)?.rankings).toEqual([
            { playerId: "a", rank: 1, score: 1 },
            { playerId: "b", rank: 2, score: 1 },
            { playerId: "c", rank: 3, score: 2 },
        ]);
        // The runner refuses anything further.
        const after = step(specials, res.state, play("b", card("9")));
        expect(after.ok).toBe(false);
        if (!after.ok) expect(after.error.code).toBe("game_over");
    });
});

describe("eca turnStarted rules", () => {
    it("draws for the player whose turn begins", () => {
        const module = createEcaModule(TURN_DRAW, "eca:turn-draw");
        const s = stateWith(
            TURN_DRAW,
            { a: [card("7"), card("8")], b: [card("9")], c: [card("10")] },
            { drawPile: [card("J", "hearts")] },
        );
        const res = step(module, s, play("a", card("7")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.currentPlayerId).toBe("b");
        expect(res.state.hands.b).toEqual([card("9"), card("J", "hearts")]);
        expect(res.events).toContainEqual({
            type: "ruleFired",
            payload: { ruleId: "turn-draw", ruleName: "Pioche d'office" },
        });
        expect(res.events).toContainEqual({
            type: "cardsDrawn",
            payload: { playerId: "b", count: 1 },
        });
    });

    it("a skip chain terminates at the players.length cap", () => {
        const module = createEcaModule(TURN_SKIP, "eca:turn-skip");
        const s = stateWith(TURN_SKIP, {
            a: [card("7"), card("8")],
            b: [card("9")],
            c: [card("10")],
        });
        const res = step(module, s, play("a", card("7")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        // b, c and a each had their fresh turn skipped onward, then the cap
        // stopped the chain — the game must never hang.
        expect(res.state.phase).toBe("playing");
        expect(res.state.currentPlayerId).toBe("b");
        expect(res.state.pendingSkips).toBe(0);
        expect(
            res.events.filter((e) => e.type === "playerSkipped"),
        ).toHaveLength(3);
    });

    it("can end the game when the incoming player's hand is short", () => {
        const module = createEcaModule(TURN_END, "eca:turn-end");
        const s = stateWith(TURN_END, {
            a: [card("7"), card("8")],
            b: [card("9")],
            c: [card("10"), card("A")],
        });
        const res = step(module, s, play("a", card("7")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("done");
        expect(res.state.winnerIds).toEqual(["b"]);
        expect(module.outcome(res.state)?.winners).toEqual(["b"]);
    });
});

describe("eca draw & pass", () => {
    it("forbids drawing and passing when the definition disables them", () => {
        const s = stateWith(MINIMAL_VALID, {
            a: [card("7")],
            b: [card("8")],
            c: [card("9")],
        });
        const refusedDraw = step(minimal, s, draw("a"));
        expect(refusedDraw.ok).toBe(false);
        if (!refusedDraw.ok) {
            expect(refusedDraw.error.code).toBe("cannot_draw");
        }
        const refusedPass = step(minimal, s, pass("a"));
        expect(refusedPass.ok).toBe(false);
        if (!refusedPass.ok) expect(refusedPass.error.code).toBe("cannot_pass");
    });

    it("passRequiresDraw: stuck player must draw first, then may pass", () => {
        // a's 2♣ matches neither the suit nor the rank of the 9♥ top card.
        let s = stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [card("2", "clubs")],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            {
                discardPile: [card("9", "hearts")],
                drawPile: [card("3", "spades")],
            },
        );
        expect(crazy.legalActions(s, "a")).toEqual([draw("a")]);
        const refused = step(crazy, s, pass("a"));
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.error.code).toBe("cannot_pass");

        s = ok(crazy, s, draw("a"));
        expect(s.hands.a).toHaveLength(2);
        expect(s.hasDrawnThisTurn).toBe(true);
        expect(s.currentPlayerId).toBe("a"); // drawing does not end the turn
        // Drawn card (3♠) still unplayable on 9♥ — pass is now open, draw is not.
        expect(crazy.legalActions(s, "a")).toEqual([pass("a")]);

        s = ok(crazy, s, pass("a"));
        expect(s.currentPlayerId).toBe("b");
        expect(s.hasDrawnThisTurn).toBe(false);
        expect(s.consecutivePasses).toBe(1);
    });

    it("allows passing without drawing when drawing is impossible", () => {
        const s = stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [card("2", "clubs")],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            { discardPile: [card("9", "hearts")], drawPile: [] },
        );
        // Empty stock, single discard — nothing to reshuffle: pass only.
        expect(crazy.legalActions(s, "a")).toEqual([pass("a")]);
        expect(step(crazy, s, pass("a")).ok).toBe(true);
    });

    it("reshuffles the discard into the stock, consuming the rng", () => {
        const s = stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [card("2", "clubs")],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            {
                drawPile: [],
                discardPile: [
                    card("5", "hearts"),
                    card("6", "hearts"),
                    card("9", "hearts"),
                ],
            },
        );
        const res = step(crazy, s, draw("a"));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.hands.a).toHaveLength(2);
        // Top card stays; the two below were reshuffled, one was drawn.
        expect(res.state.discardPile).toEqual([card("9", "hearts")]);
        expect(res.state.drawPile).toHaveLength(1);
        // rng consumed by the reshuffle — the cursor moved and is persisted.
        expect(res.state.rngState).not.toBe(s.rngState);
        // Deterministic: the same state yields the exact same result.
        expect(step(crazy, s, draw("a"))).toEqual(res);
    });

    it("deadlock guard: pass becomes legal when nothing else is", () => {
        const module = createEcaModule(KINGS_NO_PASS, "eca:kings-no-pass");
        const s = stateWith(KINGS_NO_PASS, {
            a: [card("7")],
            b: [card("8")],
            c: [card("9")],
        });
        expect(module.legalActions(s, "a")).toEqual([pass("a")]);
        expect(step(module, s, pass("a")).ok).toBe(true);
    });
});

describe("eca game end", () => {
    it("winning by emptying the hand, ties below sharing a rank", () => {
        const s = stateWith(MINIMAL_VALID, {
            a: [card("7")],
            b: [card("8"), card("9")],
            c: [card("10"), card("J")],
        });
        const res = step(minimal, s, play("a", card("7")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("done");
        expect(res.state.winnerIds).toEqual(["a"]);
        expect(res.events).toContainEqual({
            type: "gameEnded",
            payload: { winnerIds: ["a"] },
        });
        expect(minimal.outcome(res.state)).toEqual({
            rankings: [
                { playerId: "a", rank: 1, score: 0 },
                { playerId: "b", rank: 2, score: 2 },
                { playerId: "c", rank: 2, score: 2 }, // tie shares the rank
            ],
            winners: ["a"],
        });
    });

    it("blocked game: a full pass cycle on an empty stock ranks by hand size", () => {
        const module = createEcaModule(KINGS_ONLY, "eca:kings-only");
        let s = stateWith(KINGS_ONLY, {
            a: [card("7")],
            b: [card("8")],
            c: [card("9"), card("10")],
        });
        s = ok(module, s, pass("a"));
        expect(s.consecutivePasses).toBe(1);
        s = ok(module, s, pass("b"));
        expect(s.consecutivePasses).toBe(2);
        const res = step(module, s, pass("c"));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("done");
        expect(res.state.winnerIds).toEqual(["a", "b"]); // fewest cards, tied
        expect(module.outcome(res.state)).toEqual({
            rankings: [
                { playerId: "a", rank: 1, score: 1 },
                { playerId: "b", rank: 1, score: 1 },
                { playerId: "c", rank: 3, score: 2 },
            ],
            winners: ["a", "b"],
        });
    });

    it("blocked game: with draws disabled a full pass cycle ends despite a stocked pile", () => {
        // Regression: the old guard required an EMPTY draw pile, but with
        // allowDraw:false the pile never empties — a game where nobody can
        // play would pass forever (livelock). Drawing cannot help here, so
        // the cycle must end the game even though cards remain in the pile.
        const module = createEcaModule(KINGS_ONLY, "eca:kings-only-stock");
        let s = stateWith(
            KINGS_ONLY,
            {
                a: [card("7")],
                b: [card("8"), card("9")],
                c: [card("10"), card("J")],
            },
            { drawPile: [card("Q", "hearts"), card("A", "hearts")] },
        );
        // No hand holds a king: passing is each player's only legal action.
        expect(module.legalActions(s, "a")).toEqual([pass("a")]);
        s = ok(module, s, pass("a"));
        s = ok(module, s, pass("b"));
        const res = step(module, s, pass("c"));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("done");
        expect(module.isOver(res.state)).toBe(true);
        expect(res.state.winnerIds).toEqual(["a"]); // fewest cards wins
        expect(module.outcome(res.state)).toEqual({
            rankings: [
                { playerId: "a", rank: 1, score: 1 },
                { playerId: "b", rank: 2, score: 2 },
                { playerId: "c", rank: 2, score: 2 },
            ],
            winners: ["a"],
        });
    });

    it("outcome is null while the game runs", () => {
        const s = createGame(crazy, P3, 5);
        expect(crazy.outcome(s)).toBeNull();
    });
});

describe("eca view (RLS in code)", () => {
    const s = createGame(crazy, P3, 11, "view-game");

    it("reveals only the viewer's own hand", () => {
        const view = crazy.view(s, "a");
        const self = view.players.find((p) => p.id === "a");
        const other = view.players.find((p) => p.id === "b");
        expect(self?.hand).toEqual(s.hands.a);
        expect(other?.hand).toBeUndefined();
        expect(other?.handCount).toBe(s.hands.b.length);
        expect(view.self).toBe("a");
    });

    it("shows a spectator no hand at all", () => {
        const view = crazy.view(s, null);
        for (const p of view.players) expect(p.hand).toBeUndefined();
        expect(view.self).toBeNull();
    });

    it("exposes counters and the top discard, never the pile order", () => {
        const view = crazy.view(s, "a");
        expect(view.drawPileCount).toBe(s.drawPile.length);
        expect(view.discardCount).toBe(s.discardPile.length);
        expect(view.topDiscard).toEqual(s.discardPile.at(-1));
        expect(view.definition.name).toBe("Huit américain");
        expect(view.definition.rules.map((r) => r.id)).toContain("wild-eight");
    });

    it("clientState gives a spectator zero legal actions", () => {
        const cs = clientState(crazy, s, null);
        expect(cs.legalActions).toEqual([]);
        expect(cs.isOver).toBe(false);
    });
});

describe("eca legalActions/apply parity", () => {
    it("every offered action is accepted by apply (hints never lie)", () => {
        const s = stateWith(
            CRAZY_EIGHTS_LIKE,
            {
                a: [
                    card("5", "hearts"),
                    card("8", "clubs"),
                    card("2", "clubs"),
                ],
                b: [card("9", "spades")],
                c: [card("K", "diamonds")],
            },
            {
                discardPile: [card("9", "hearts")],
                drawPile: [card("3", "clubs")],
            },
        );
        const actions = crazy.legalActions(s, "a");
        // suit match + wild 8 + draw; the 2♣ is not offered, pass needs a draw.
        expect(actions).toEqual([
            play("a", card("5", "hearts")),
            play("a", card("8", "clubs")),
            draw("a"),
        ]);
        for (const action of actions) {
            expect(step(crazy, s, action).ok).toBe(true);
        }
        // …and the card legalActions withheld is indeed refused.
        const refused = step(crazy, s, play("a", card("2", "clubs")));
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.error.code).toBe("illegal_card");
    });

    it("offers nothing out of turn or once the game is done", () => {
        const s = createGame(crazy, P3, 3);
        expect(crazy.legalActions(s, "b")).toHaveLength(0);
        expect(crazy.legalActions({ ...s, phase: "done" }, "a")).toHaveLength(
            0,
        );
    });
});

describe("eca determinism (replay through the runner)", () => {
    it("re-derives the exact final state from (seed, action log)", () => {
        const seed = 20260711;
        const gameId = "replay-game";
        const log: EcaAction[] = [];
        let s = createGame(crazy, P3, seed, gameId);

        let guard = 0;
        while (!crazy.isOver(s) && guard++ < 5_000) {
            const current = s.currentPlayerId;
            if (current === null) throw new Error("no current player");
            const action = crazy.legalActions(s, current)[0];
            expect(action).toBeDefined();
            const res = dispatch(crazy, s, action, current);
            if (!res.ok) throw new Error(res.error.code);
            log.push(action);
            s = res.state;
        }

        expect(crazy.isOver(s)).toBe(true);
        expect(log.length).toBeGreaterThan(0);
        const replayed = replay(crazy, P3, seed, log, gameId);
        expect(replayed).toEqual(s);
        expect(crazy.outcome(replayed)).toEqual(crazy.outcome(s));
    });
});
