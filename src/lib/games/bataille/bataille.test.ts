import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { createRng } from "@/lib/engine/rng";
import { createGame, dispatch } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import {
    type BatailleAction,
    type BatailleState,
    bataille,
    MAX_ROUNDS,
    WAR_STAKE,
} from "./bataille";

const players: Player[] = [
    { id: "alice", name: "Alice", seat: 0 },
    { id: "bob", name: "Bob", seat: 1 },
];

function suited(rank: Rank, suit: Suit = "spades"): CardDescriptor {
    return { type: "suited", suit, rank };
}

/** Build a synthetic state from explicit draw piles (bottom → top). */
function makeState(
    aDraw: CardDescriptor[],
    bDraw: CardDescriptor[],
): BatailleState {
    return {
        gameId: "test",
        players,
        phase: "reveal",
        currentPlayerId: null,
        turn: 0,
        seed: 0,
        rngState: 1,
        piles: {
            alice: { draw: aDraw, won: [] },
            bob: { draw: bDraw, won: [] },
        },
        lastReveal: { alice: [], bob: [] },
        lastWinner: null,
        rounds: 0,
    };
}

const flip = (playerId: string) => ({ type: "flip" as const, playerId });
const total = (s: BatailleState, id: string) =>
    s.piles[id].draw.length + s.piles[id].won.length;

describe("bataille setup", () => {
    it("deals all 52 distinct cards, 26 each", () => {
        const s = createGame(bataille, players, 1234);
        expect(s.piles.alice.draw).toHaveLength(26);
        expect(s.piles.bob.draw).toHaveLength(26);
        const keys = [...s.piles.alice.draw, ...s.piles.bob.draw].map(cardKey);
        expect(new Set(keys).size).toBe(52);
    });

    it("is deterministic for a fixed seed", () => {
        const a = createGame(bataille, players, 7);
        const b = createGame(bataille, players, 7);
        expect(a.piles.alice.draw.map(cardKey)).toEqual(
            b.piles.alice.draw.map(cardKey),
        );
    });

    it("rejects an illegal player count", () => {
        expect(() => createGame(bataille, [players[0]], 1)).toThrow(RangeError);
    });
});

describe("bataille rounds", () => {
    it("awards both cards to the higher rank", () => {
        const s = makeState([suited("K")], [suited("Q")]);
        const res = bataille.apply(s, flip("alice"), createRng(s.rngState));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.lastWinner).toBe("alice");
        expect(total(res.state, "alice")).toBe(2);
        expect(total(res.state, "bob")).toBe(0);
    });

    it("uses the French war stake: one card face down", () => {
        expect(WAR_STAKE).toBe(1);
    });

    it("resolves a war on a tie and sweeps the whole pot", () => {
        // Top cards (last element) tie on 7; after each lays ONE face-down
        // (French rule), the deciding flip is Alice's Ace vs Bob's 2.
        const s = makeState(
            [suited("A"), suited("3"), suited("7")],
            [
                suited("2", "hearts"),
                suited("3", "hearts"),
                suited("7", "hearts"),
            ],
        );
        const res = bataille.apply(s, flip("alice"), createRng(s.rngState));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.lastWinner).toBe("alice");
        expect(total(res.state, "alice")).toBe(6);
        expect(total(res.state, "bob")).toBe(0);
        // Face-down war stakes stay hidden: only the two flipped cards show.
        expect(res.state.lastReveal.alice).toHaveLength(2);
    });

    it("recycles the won pile when the stock empties", () => {
        const s: BatailleState = {
            ...makeState([], []),
            piles: {
                alice: { draw: [], won: [suited("K")] },
                bob: { draw: [], won: [suited("Q")] },
            },
        };
        const res = bataille.apply(s, flip("bob"), createRng(s.rngState));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.lastWinner).toBe("alice"); // K beats Q after recycle
    });
});

describe("bataille round cap", () => {
    it("ends the game after MAX_ROUNDS and ranks by card count", () => {
        const s: BatailleState = {
            ...makeState(
                [suited("5"), suited("3"), suited("K")],
                [suited("4", "hearts"), suited("Q", "hearts")],
            ),
            rounds: MAX_ROUNDS - 1,
        };
        const res = bataille.apply(s, flip("alice"), createRng(s.rngState));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.rounds).toBe(MAX_ROUNDS);
        expect(bataille.isOver(res.state)).toBe(true);
        expect(res.events.map((e) => e.type)).toEqual([
            "round_resolved",
            "round_limit",
            "game_over",
        ]);
        // K beats Q: Alice holds 4, Bob 1 — both still in, decided on count.
        expect(bataille.outcome(res.state)).toEqual({
            rankings: [
                { playerId: "alice", rank: 1, score: 4 },
                { playerId: "bob", rank: 2, score: 1 },
            ],
            winners: ["alice"],
        });
    });

    it("shares the rank when the capped game ends on equal counts", () => {
        const s: BatailleState = {
            ...makeState(
                [suited("5"), suited("K")],
                [
                    suited("5", "hearts"),
                    suited("6", "hearts"),
                    suited("7", "hearts"),
                    suited("Q", "hearts"),
                ],
            ),
            rounds: MAX_ROUNDS - 1,
        };
        const res = bataille.apply(s, flip("bob"), createRng(s.rngState));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const outcome = bataille.outcome(res.state);
        expect(outcome?.rankings.map((r) => r.rank)).toEqual([1, 1]);
        expect(outcome?.winners).toHaveLength(2);
    });

    it("keeps playing below the cap", () => {
        const s: BatailleState = {
            ...makeState(
                [suited("5"), suited("K")],
                [suited("4", "hearts"), suited("Q", "hearts")],
            ),
            rounds: MAX_ROUNDS - 2,
        };
        const res = bataille.apply(s, flip("alice"), createRng(s.rngState));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(bataille.isOver(res.state)).toBe(false);
    });
});

describe("bataille runner contract", () => {
    it("refuses a malformed action instead of throwing", () => {
        const s = createGame(bataille, players, 3);
        const bogus = [
            null,
            { type: "flip" },
            { type: "flip", playerId: 42 },
        ] as unknown as BatailleAction[];
        for (const action of bogus) {
            const res = bataille.apply(s, action, createRng(s.rngState));
            expect(res.ok).toBe(false);
            if (res.ok) continue;
            expect(res.error.code).toBe("invalid_action");
        }
        const unknown = {
            type: "cheat",
            playerId: "alice",
        } as unknown as BatailleAction;
        const res = bataille.apply(s, unknown, createRng(s.rngState));
        expect(res.ok).toBe(false);
    });

    it("rejects an action spoofing another player", () => {
        const s = createGame(bataille, players, 3);
        const res = dispatch(bataille, s, flip("alice"), "bob");
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("identity_mismatch");
    });

    it("refuses actions once the game is over", () => {
        const done: BatailleState = {
            ...makeState([suited("A")], []),
            phase: "done",
        };
        const res = dispatch(bataille, done, flip("alice"), "alice");
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.error.code).toBe("game_over");
    });
});

describe("bataille end to end", () => {
    it("plays to completion, conserves all 52 cards, and names a winner", () => {
        let s = createGame(bataille, players, 20260606);
        let guard = 0;
        while (!bataille.isOver(s) && guard++ < MAX_ROUNDS + 10) {
            const res = dispatch(bataille, s, flip("alice"), "alice");
            expect(res.ok).toBe(true);
            if (!res.ok) break;
            s = res.state;
        }

        expect(bataille.isOver(s)).toBe(true);
        expect(total(s, "alice") + total(s, "bob")).toBe(52); // conservation
        const outcome = bataille.outcome(s);
        expect(outcome).not.toBeNull();
        expect(outcome?.winners).toHaveLength(1);
    });
});

describe("bataille view (RLS in code)", () => {
    it("exposes counts and public reveals but no pile contents", () => {
        const s = createGame(bataille, players, 11);
        const view = bataille.view(s, "alice");

        const alice = view.players.find((p) => p.playerId === "alice");
        expect(alice?.drawCount).toBe(26);
        expect(alice?.lastReveal).toEqual([]);
        expect(view.self).toBe("alice");
        // The view type carries no `draw`/`won` card arrays at all — opponents'
        // (and one's own face-down) cards are unreconstructable from it.
        expect(Object.keys(view.players[0])).not.toContain("draw");
    });
});
