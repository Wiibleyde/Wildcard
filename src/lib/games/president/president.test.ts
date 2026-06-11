import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { createGame, dispatch } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import {
    DEFAULT_PRESIDENT_RULES,
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
        rules: DEFAULT_PRESIDENT_RULES,
        hands,
        pile: [],
        combo: null,
        passed: [],
        finished: [],
        demoted: [],
        lastPlayerId: null,
        ...overrides,
    };
}

/** Classic ruleset — disables the French table rules to isolate the base. */
const CLASSIC = {
    twoClosesTrick: false,
    finishOnTwoPenalty: false,
} as const;

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

/** Compact, order-independent view of a legal-action set: ["7x2", "pass", …]. */
function summary(actions: readonly PresidentAction[]): string[] {
    return actions
        .map((a) => {
            if (a.type === "pass") return "pass";
            const first = a.cards[0];
            const rank = first.type === "suited" ? first.rank : "?";
            return `${rank}x${a.cards.length}`;
        })
        .sort();
}

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
        // Classic rules so the 2 neither sweeps nor demotes — pure ranking.
        const s = state3(
            { a: [card("A")], b: [card("2")], c: [card("K")] },
            {
                combo: { rank: "A", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
                rules: CLASSIC,
            },
        );
        const res = step(s, play("b", [card("2")]));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.combo).toEqual({ rank: "2", count: 1 });
        // Without the penalty rule, going out on a 2 ranks normally.
        expect(res.state.finished).toEqual(["b"]);
        expect(res.state.demoted).toEqual([]);
    });
});

describe("president french table rules", () => {
    it("a 2 sweeps the trick and the same player leads again", () => {
        const s = state3(
            {
                a: [card("5"), card("7")],
                b: [card("2"), card("9")],
                c: [card("K"), card("4")],
            },
            {
                combo: { rank: "K", count: 1 },
                pile: [{ playerId: "c", cards: [card("K", "hearts")] }],
                lastPlayerId: "c",
                currentPlayerId: "b",
                passed: ["a"],
            },
        );
        const res = step(s, play("b", [card("2")]));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.combo).toBeNull();
        expect(res.state.pile).toHaveLength(0);
        expect(res.state.passed).toHaveLength(0);
        expect(res.state.currentPlayerId).toBe("b"); // leads again
        expect(res.events).toContainEqual({
            type: "trick_cleared",
            payload: { leadPlayerId: "b" },
        });
    });

    it("leading a 2 sweeps immediately and the leader replays", () => {
        const s = state3({
            a: [card("2"), card("6")],
            b: [card("9")],
            c: [card("K")],
        });
        const next = ok(s, play("a", [card("2")]));
        expect(next.combo).toBeNull();
        expect(next.currentPlayerId).toBe("a");
    });

    it("going out on a 2 demotes the player to last place", () => {
        let s = state3({
            a: [card("2")],
            b: [card("9"), card("J")],
            c: [card("4")],
        });
        s = ok(s, play("a", [card("2")])); // a goes out on a 2 → demoted
        expect(s.demoted).toEqual(["a"]);
        expect(s.finished).toEqual([]);
        expect(s.phase).toBe("playing");
        expect(s.currentPlayerId).toBe("b"); // sweep skips the demoted actor

        s = ok(s, play("b", [card("9")]));
        s = ok(s, pass("c")); // trick clears back to b
        s = ok(s, play("b", [card("J")])); // b out cleanly → round over
        expect(s.phase).toBe("done");

        const outcome = president.outcome(s);
        expect(outcome?.rankings).toEqual([
            { playerId: "b", rank: 1 }, // Président
            { playerId: "c", rank: 2 }, // still holding cards
            { playerId: "a", rank: 3 }, // Trou — demoted despite going out first
        ]);
        expect(outcome?.winners).toEqual(["b"]);
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

    it("emits trick_cleared with the new leader when the trick sweeps", () => {
        const s = state3(
            {
                a: [card("5"), card("Q")],
                b: [card("9"), card("J")],
                c: [card("10"), card("A")],
            },
            {
                combo: { rank: "10", count: 1 },
                pile: [{ playerId: "c", cards: [card("10", "hearts")] }],
                lastPlayerId: "c",
                currentPlayerId: "a",
                passed: ["b"],
            },
        );
        const res = step(s, pass("a")); // last responder folds → sweep to c
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.events).toContainEqual({
            type: "trick_cleared",
            payload: { leadPlayerId: "c" },
        });
        expect(res.state.currentPlayerId).toBe("c");
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

    it("exposes the active table rules to every viewer", () => {
        const s = createGame(president, P4, 11);
        expect(president.view(s, null).rules).toEqual(DEFAULT_PRESIDENT_RULES);
    });
});

describe("president legal actions (which cards are playable)", () => {
    it("leading offers every count of every rank, and never a pass", () => {
        const s = state3({
            a: [card("5"), card("5", "hearts"), card("7")],
            b: [],
            c: [],
        });
        // two 5s → play 1 or 2; one 7 → play 1. No pass when leading.
        expect(summary(president.legalActions(s, "a"))).toEqual([
            "5x1",
            "5x2",
            "7x1",
        ]);
    });

    it("responding requires the same count AND a strictly higher rank", () => {
        const s = state3(
            {
                a: [],
                b: [card("8"), card("8", "hearts"), card("9"), card("K")],
                c: [],
            },
            {
                combo: { rank: "7", count: 2 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        // pair of 8 beats pair of 7; lone 9/K can't match count 2 → only 8x2 + pass.
        expect(summary(president.legalActions(s, "b"))).toEqual([
            "8x2",
            "pass",
        ]);
    });

    it("treats an equal rank as NOT playable (strictly higher only)", () => {
        const s = state3(
            { a: [], b: [card("8"), card("9")], c: [] },
            {
                combo: { rank: "8", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        expect(summary(president.legalActions(s, "b"))).toEqual([
            "9x1",
            "pass",
        ]);
    });

    it("offers nothing out of turn, when finished, or once the round is over", () => {
        const base = state3({
            a: [card("5")],
            b: [card("9")],
            c: [card("K")],
        });
        expect(president.legalActions(base, "b")).toHaveLength(0); // not b's turn
        expect(
            president.legalActions({ ...base, finished: ["a"] }, "a"),
        ).toHaveLength(0); // already out
        expect(
            president.legalActions({ ...base, phase: "done" }, "a"),
        ).toHaveLength(0); // round over
    });

    it("only offers moves that apply() actually accepts (hints never lie)", () => {
        const lead = state3({
            a: [card("5"), card("5", "hearts"), card("7")],
            b: [card("9")],
            c: [card("K")],
        });
        for (const action of president.legalActions(lead, "a")) {
            expect(step(lead, action).ok).toBe(true);
        }

        const respond = state3(
            {
                a: [],
                b: [card("8"), card("8", "hearts"), card("J")],
                c: [],
            },
            {
                combo: { rank: "7", count: 2 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        for (const action of president.legalActions(respond, "b")) {
            expect(step(respond, action).ok).toBe(true);
        }
    });
});
