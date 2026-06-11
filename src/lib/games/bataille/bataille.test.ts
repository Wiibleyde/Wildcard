import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { createRng } from "@/lib/engine/rng";
import { createGame, dispatch } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import { type BatailleState, bataille } from "./bataille";

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

    it("resolves a war on a tie and sweeps the whole pot", () => {
        // Top cards (last element) tie on 7; after each lays 3 face-down, the
        // deciding flip is Alice's Ace vs Bob's 2.
        const s = makeState(
            [suited("A"), suited("3"), suited("3"), suited("3"), suited("7")],
            [suited("2"), suited("3"), suited("3"), suited("3"), suited("7")],
        );
        const res = bataille.apply(s, flip("alice"), createRng(s.rngState));

        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.lastWinner).toBe("alice");
        expect(total(res.state, "alice")).toBe(10);
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

describe("bataille runner contract", () => {
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
        while (!bataille.isOver(s) && guard++ < 10_000) {
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
