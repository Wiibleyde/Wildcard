import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/engine/deck";
import { createGame, dispatch } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import {
    type PresidentAction,
    type PresidentState,
    president,
} from "./president";

const P3: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
    { id: "c", name: "C", seat: 2 },
];

const P4: Player[] = [...P3, { id: "d", name: "D", seat: 3 }];

function card(rank: Rank, suit: Suit = "spades"): CardDescriptor {
    return { type: "suited", suit, rank };
}

function state3(
    hands: Record<string, CardDescriptor[]>,
    overrides: Partial<PresidentState> = {},
): PresidentState {
    return {
        gameId: "test",
        players: P3,
        phase: "playing",
        currentPlayerId: "a",
        turn: 0,
        seed: 0,
        rngState: 1,
        hands,
        pile: [],
        combo: null,
        passed: [],
        finished: [],
        lastPlayerId: null,
        ...overrides,
    };
}

/** Route through the runner (supplies rng + identity check). */
function step(
    s: PresidentState,
    action: PresidentAction,
): ReturnType<typeof dispatch<PresidentState, PresidentAction, unknown>> {
    return dispatch(president, s, action, action.playerId);
}

function ok(s: PresidentState, action: PresidentAction): PresidentState {
    const res = step(s, action);
    if (!res.ok) throw new Error(`unexpected refusal: ${res.error.code}`);
    return res.state;
}

const play = (id: string, cards: CardDescriptor[]): PresidentAction => ({
    type: "play",
    playerId: id,
    cards,
});
const pass = (id: string): PresidentAction => ({ type: "pass", playerId: id });

describe("president setup", () => {
    it("deals all 52 cards across the players with none shared", () => {
        const s = createGame(president, P4, 1234);
        const all = P4.flatMap((p) => s.hands[p.id].map(cardKey));
        expect(all).toHaveLength(52);
        expect(new Set(all).size).toBe(52);
    });

    it("seats the holder of 3♣ as the first leader", () => {
        const s = createGame(president, P4, 4321);
        const clubsThree = cardKey(card("3", "clubs"));
        expect(s.hands[s.currentPlayerId].map(cardKey)).toContain(clubsThree);
    });

    it("is deterministic for a fixed seed", () => {
        const a = createGame(president, P4, 99);
        const b = createGame(president, P4, 99);
        expect(a.hands.a.map(cardKey)).toEqual(b.hands.a.map(cardKey));
    });

    it("rejects fewer than three players", () => {
        expect(() => createGame(president, P3.slice(0, 2), 1)).toThrow(
            RangeError,
        );
    });
});

describe("president move legality", () => {
    it("requires a strictly higher rank to beat the table", () => {
        const s = state3(
            { a: [card("5")], b: [card("6")], c: [card("4")] },
            {
                combo: { rank: "5", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "c",
            },
        );
        const res = step(s, play("c", [card("4")]));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("too_low");
    });

    it("requires the same card count as the table", () => {
        const s = state3(
            { a: [], b: [card("9")], c: [] },
            {
                combo: { rank: "7", count: 2 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        const res = step(s, play("b", [card("9")]));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("wrong_count");
    });

    it("rejects mixed ranks", () => {
        const s = state3({ a: [card("5"), card("6")], b: [], c: [] });
        const res = step(s, play("a", [card("5"), card("6")]));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("mixed_ranks");
    });

    it("rejects cards not held in hand", () => {
        const s = state3({ a: [card("5")], b: [], c: [] });
        const res = step(s, play("a", [card("K")]));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("not_in_hand");
    });

    it("rejects acting out of turn", () => {
        const s = state3({ a: [card("5")], b: [card("9")], c: [] });
        const res = step(s, play("b", [card("9")]));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("not_your_turn");
    });

    it("forbids passing on a fresh lead", () => {
        const s = state3({ a: [card("5")], b: [], c: [] });
        const res = step(s, pass("a"));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("cannot_pass_lead");
    });

    it("lets a 2 beat an Ace (ranking 3-low to 2-high)", () => {
        const s = state3(
            { a: [card("A")], b: [card("2")], c: [] },
            {
                combo: { rank: "A", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        const res = step(s, play("b", [card("2")]));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.combo).toEqual({ rank: "2", count: 1 });
    });
});

describe("president trick flow", () => {
    it("clears the trick to the top player once everyone else passes", () => {
        let s = state3({
            a: [card("5"), card("Q")],
            b: [card("9"), card("J")],
            c: [card("10"), card("A")],
        });
        s = ok(s, play("a", [card("5")])); // a leads
        expect(s.currentPlayerId).toBe("b");
        s = ok(s, play("b", [card("9")]));
        s = ok(s, play("c", [card("10")])); // c is now the top
        expect(s.currentPlayerId).toBe("a");
        s = ok(s, pass("a"));
        s = ok(s, pass("b")); // back to c → trick clears

        expect(s.combo).toBeNull();
        expect(s.pile).toHaveLength(0);
        expect(s.passed).toHaveLength(0);
        expect(s.currentPlayerId).toBe("c");
    });

    it("records finishing order and keeps the round going", () => {
        const s = state3({ a: [card("5")], b: [card("9")], c: [card("K")] });
        const next = ok(s, play("a", [card("5")])); // a goes out leading
        expect(next.finished).toEqual(["a"]);
        expect(next.phase).toBe("playing");
        expect(next.currentPlayerId).toBe("b"); // must respond to a's 5
        expect(next.combo).toEqual({ rank: "5", count: 1 });
    });
});

describe("president end to end", () => {
    it("plays to completion and ranks every player", () => {
        let s = createGame(president, P4, 20260606);
        let guard = 0;
        while (!president.isOver(s) && guard++ < 10_000) {
            const actions = president.legalActions(s, s.currentPlayerId);
            // Greedy bot: prefer shedding a card over passing.
            const choice = actions[0];
            expect(choice).toBeDefined();
            s = ok(s, choice);
        }

        expect(president.isOver(s)).toBe(true);
        const outcome = president.outcome(s);
        expect(outcome?.rankings).toHaveLength(4); // every seat ranked
        expect(outcome?.winners).toHaveLength(1); // exactly one Président
        expect(new Set(outcome?.rankings.map((r) => r.rank)).size).toBe(4);
    });
});

describe("president view (RLS in code)", () => {
    it("reveals only the viewer's own hand", () => {
        const s = createGame(president, P4, 11);
        const view = president.view(s, "a");

        const self = view.players.find((p) => p.playerId === "a");
        const other = view.players.find((p) => p.playerId === "b");

        expect(self?.hand).toBeDefined();
        expect(self?.hand).toHaveLength(s.hands.a.length);
        expect(other?.hand).toBeUndefined(); // opponents redacted
        expect(other?.handCount).toBe(s.hands.b.length); // count still public
    });
});
