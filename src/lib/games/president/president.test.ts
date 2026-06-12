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
        revolution: false,
        equalLock: false,
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
    equalRank: false,
    equalRankLock: false,
    revolution: false,
    quadClosesTrick: false,
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

    it("seats the holder of the Queen of Hearts as the first leader", () => {
        const s = createGame(president, P4, 4321);
        const queenOfHearts = cardKey(card("Q", "hearts"));
        expect(s.hands[s.currentPlayerId].map(cardKey)).toContain(
            queenOfHearts,
        );
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
    it("rejects a lower rank than the table", () => {
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

    it("locks the trick on a matched rank (« ou rien ») without auto-passing", () => {
        const s = state3(
            {
                a: [card("10", "hearts"), card("4", "hearts")],
                b: [card("10"), card("5")],
                c: [card("J")],
            },
            {
                combo: { rank: "10", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        const res = step(s, play("b", [card("10")]));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.combo).toEqual({ rank: "10", count: 1 });
        expect(res.state.equalLock).toBe(true);
        expect(res.events).toContainEqual({
            type: "or_nothing",
            payload: { playerId: "b", rank: "10" },
        });
        // No auto-pass: c keeps the turn — but holding no 10, may only pass.
        expect(res.state.passed).toHaveLength(0);
        expect(res.state.currentPlayerId).toBe("c");
        expect(summary(president.legalActions(res.state, "c"))).toEqual([
            "pass",
        ]);
    });

    it("refuses a higher rank while the lock holds, accepts the match", () => {
        const s = state3(
            { a: [], b: [card("10", "diamonds"), card("K")], c: [] },
            {
                combo: { rank: "10", count: 1 },
                equalLock: true,
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        const high = step(s, play("b", [card("K")]));
        expect(high.ok).toBe(false);
        if (!high.ok) expect(high.error.code).toBe("too_low");
        expect(step(s, play("b", [card("10", "diamonds")])).ok).toBe(true);
    });

    it("lifts the lock when the trick clears", () => {
        const s = state3(
            { a: [card("4")], b: [card("K")], c: [card("J")] },
            {
                combo: { rank: "10", count: 1 },
                equalLock: true,
                pile: [{ playerId: "b", cards: [card("10")] }],
                lastPlayerId: "b",
                currentPlayerId: "c",
                passed: ["a"],
            },
        );
        const res = step(s, pass("c")); // back to b → sweep
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.equalLock).toBe(false);
        expect(res.state.combo).toBeNull();
        expect(res.state.currentPlayerId).toBe("b");
    });

    it("does not lock when the rule is disabled — higher ranks stay legal", () => {
        const s = state3(
            {
                a: [card("10", "hearts")],
                b: [card("10")],
                c: [card("J")],
            },
            {
                combo: { rank: "10", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
                rules: { ...DEFAULT_PRESIDENT_RULES, equalRankLock: false },
            },
        );
        const res = step(s, play("b", [card("10")]));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.equalLock).toBe(false);
        expect(res.events.some((e) => e.type === "or_nothing")).toBe(false);
        // c may still climb with the Jack.
        expect(summary(president.legalActions(res.state, "c"))).toEqual([
            "Jx1",
            "pass",
        ]);
    });

    it("rejects an equal rank when « ou rien » is disabled", () => {
        const s = state3(
            { a: [card("10", "hearts")], b: [card("10")], c: [card("J")] },
            {
                combo: { rank: "10", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
                rules: CLASSIC,
            },
        );
        const res = step(s, play("b", [card("10")]));
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

describe("president revolution", () => {
    const quad = (rank: Rank): CardDescriptor[] => [
        card(rank, "spades"),
        card(rank, "hearts"),
        card(rank, "diamonds"),
        card(rank, "clubs"),
    ];

    it("a quad inverts the ranking until the trick clears", () => {
        let s = state3({
            a: [...quad("9"), card("K")],
            b: [card("5"), card("A")],
            c: [card("J"), card("3")],
        });
        const res = step(s, play("a", quad("9")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.revolution).toBe(true);
        expect(res.events).toContainEqual({
            type: "revolution",
            payload: { active: true },
        });
        s = res.state;

        // The combo is a quad — b holds no quad, so only pass remains.
        expect(summary(president.legalActions(s, "b"))).toEqual(["pass"]);

        s = ok(s, pass("b"));
        s = ok(s, pass("c")); // trick clears back to a
        expect(s.revolution).toBe(false); // revolution ends with the sweep
        expect(s.combo).toBeNull();
    });

    it("a counter-quad flips the ranking back", () => {
        const s = state3(
            {
                a: [card("K")],
                b: [...quad("5"), card("A")],
                c: [card("J")],
            },
            {
                combo: { rank: "9", count: 4 },
                revolution: true,
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        // Quad of 5s beats the quad of 9s under revolution AND cancels it.
        const res = step(s, play("b", quad("5")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.revolution).toBe(false);
        expect(res.events).toContainEqual({
            type: "revolution",
            payload: { active: false },
        });
    });

    it("inverts single-card beats while a revolution holds", () => {
        const s = state3(
            { a: [], b: [card("3"), card("K")], c: [] },
            {
                combo: { rank: "8", count: 1 },
                revolution: true,
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        // 3 (now strongest) beats the 8; the K (now weak) does not.
        expect(summary(president.legalActions(s, "b"))).toEqual([
            "3x1",
            "pass",
        ]);
        const high = step(s, play("b", [card("K")]));
        expect(high.ok).toBe(false);
        const low = step(s, play("b", [card("3")]));
        expect(low.ok).toBe(true);
    });

    it("does not trigger when the rule is disabled", () => {
        const s = state3(
            {
                a: [...quad("9"), card("K")],
                b: [card("5")],
                c: [card("J")],
            },
            { rules: CLASSIC },
        );
        const res = step(s, play("a", quad("9")));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.revolution).toBe(false);
    });
});

describe("president carré (« le carré ferme le pli »)", () => {
    it("completing a quad with a second pair sweeps and the completer leads", () => {
        const s = state3(
            {
                a: [card("8", "spades"), card("8", "hearts"), card("K")],
                b: [card("9"), card("J")],
                c: [card("4"), card("A")],
            },
            {
                combo: { rank: "8", count: 2 },
                pile: [
                    {
                        playerId: "c",
                        cards: [card("8", "diamonds"), card("8", "clubs")],
                    },
                ],
                lastPlayerId: "c",
                currentPlayerId: "a",
            },
        );
        const res = step(
            s,
            play("a", [card("8", "spades"), card("8", "hearts")]),
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.combo).toBeNull();
        expect(res.state.pile).toHaveLength(0);
        expect(res.state.currentPlayerId).toBe("a"); // completer leads anew
        expect(res.events).toContainEqual({
            type: "trick_cleared",
            payload: { leadPlayerId: "a" },
        });
        // The close supersedes « ou rien » — no lock announcement on a sweep.
        expect(res.events.some((e) => e.type === "or_nothing")).toBe(false);
        expect(res.state.equalLock).toBe(false);
    });

    it("completing a quad as the fourth single sweeps the trick", () => {
        const s = state3(
            {
                a: [card("8", "clubs"), card("K")],
                b: [card("9"), card("J")],
                c: [card("4"), card("A")],
            },
            {
                combo: { rank: "8", count: 1 },
                pile: [
                    { playerId: "a", cards: [card("8", "spades")] },
                    { playerId: "b", cards: [card("8", "hearts")] },
                    { playerId: "c", cards: [card("8", "diamonds")] },
                ],
                equalLock: true, // engaged by the second 8
                lastPlayerId: "c",
                currentPlayerId: "a",
            },
        );
        const res = step(s, play("a", [card("8", "clubs")]));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.combo).toBeNull();
        expect(res.state.currentPlayerId).toBe("a");
    });

    it("keeps the trick open when the rule is disabled", () => {
        const s = state3(
            {
                a: [card("8", "spades"), card("8", "hearts"), card("K")],
                b: [card("9"), card("J")],
                c: [card("4"), card("A")],
            },
            {
                combo: { rank: "8", count: 2 },
                pile: [
                    {
                        playerId: "c",
                        cards: [card("8", "diamonds"), card("8", "clubs")],
                    },
                ],
                lastPlayerId: "c",
                currentPlayerId: "a",
                rules: { ...DEFAULT_PRESIDENT_RULES, quadClosesTrick: false },
            },
        );
        const res = step(
            s,
            play("a", [card("8", "spades"), card("8", "hearts")]),
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        // Plain equal-rank play: the trick stays open, b keeps the turn.
        expect(res.state.combo).toEqual({ rank: "8", count: 2 });
        expect(res.state.passed).toHaveLength(0);
        expect(res.state.currentPlayerId).toBe("b");
    });

    it("a quad from hand stays a revolution and does not close the trick", () => {
        const s = state3({
            a: [
                card("9", "spades"),
                card("9", "hearts"),
                card("9", "diamonds"),
                card("9", "clubs"),
                card("K"),
            ],
            b: [card("5"), card("A")],
            c: [card("J"), card("3")],
        });
        const res = step(s, play("a", s.hands.a.slice(0, 4)));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.revolution).toBe(true);
        expect(res.state.combo).toEqual({ rank: "9", count: 4 }); // trick open
        expect(res.state.currentPlayerId).toBe("b");
    });

    it("a quad from hand closes the trick when revolution is disabled", () => {
        const s = state3(
            {
                a: [
                    card("9", "spades"),
                    card("9", "hearts"),
                    card("9", "diamonds"),
                    card("9", "clubs"),
                    card("K"),
                ],
                b: [card("5"), card("A")],
                c: [card("J"), card("3")],
            },
            { rules: { ...DEFAULT_PRESIDENT_RULES, revolution: false } },
        );
        const res = step(s, play("a", s.hands.a.slice(0, 4)));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.revolution).toBe(false);
        expect(res.state.combo).toBeNull();
        expect(res.state.currentPlayerId).toBe("a"); // leads again
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

    it("responding requires the same count AND an equal or higher rank", () => {
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

    it("offers an equal rank as playable (equal or higher beats)", () => {
        const s = state3(
            { a: [], b: [card("8"), card("9")], c: [] },
            {
                combo: { rank: "8", count: 1 },
                lastPlayerId: "a",
                currentPlayerId: "b",
            },
        );
        expect(summary(president.legalActions(s, "b"))).toEqual([
            "8x1",
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
