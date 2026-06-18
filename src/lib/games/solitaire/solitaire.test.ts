import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit } from "@/lib/card/types";
import { createRng } from "@/lib/engine/rng";
import { createGame, dispatch, replay } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import {
    type SolitaireAction,
    type SolitaireColumn,
    type SolitaireState,
    solitaire,
} from "./solitaire";

const players: Player[] = [{ id: "solo", name: "Solo", seat: 0 }];

function suited(rank: Rank, suit: Suit = "spades"): CardDescriptor {
    return { type: "suited", suit, rank };
}

const ORDER: Rank[] = [
    "A",
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
];

/** A→K of one suit, optionally truncated to `upTo` cards. */
function pile(suit: Suit, upTo = 13): CardDescriptor[] {
    return ORDER.slice(0, upTo).map((rank) => suited(rank, suit));
}

const EMPTY_COLUMN: SolitaireColumn = { down: [], up: [] };

function makeState(patch: Partial<SolitaireState>): SolitaireState {
    return {
        gameId: "test",
        players,
        phase: "playing",
        currentPlayerId: "solo",
        turn: 0,
        seed: 0,
        rngState: 1,
        stock: [],
        waste: [],
        foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
        tableau: Array.from({ length: 7 }, () => EMPTY_COLUMN),
        moves: 0,
        ...patch,
    };
}

describe("solitaire — deal", () => {
    it("deals a Klondike tableau and parks the rest in the stock", () => {
        const state = createGame(solitaire, players, 42);
        expect(state.tableau).toHaveLength(7);
        state.tableau.forEach((col, i) => {
            expect(col.down).toHaveLength(i); // 0,1,…,6 hidden
            expect(col.up).toHaveLength(1); // one face-up each
        });
        // 28 dealt to the tableau, 24 left in the stock, waste empty.
        expect(state.stock).toHaveLength(24);
        expect(state.waste).toHaveLength(0);
        expect(state.phase).toBe("playing");
    });

    it("is deterministic in the seed (replayable deal)", () => {
        const a = createGame(solitaire, players, 7);
        const b = createGame(solitaire, players, 7);
        expect(b.stock).toEqual(a.stock);
        expect(b.tableau).toEqual(a.tableau);
    });
});

describe("solitaire — stock & waste", () => {
    it("deals the top card of the stock face-up onto the waste", () => {
        const state = makeState({ stock: [suited("3"), suited("9")] });
        const res = dispatch(
            solitaire,
            state,
            { type: "draw", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.stock).toHaveLength(1);
        expect(res.state.waste.at(-1)).toEqual(suited("9"));
    });

    it("recycles the waste back into the stock when it empties", () => {
        const waste = [suited("A"), suited("2"), suited("3")];
        const state = makeState({ stock: [], waste });
        const res = dispatch(
            solitaire,
            state,
            { type: "draw", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.waste).toHaveLength(0);
        expect(res.state.stock).toHaveLength(3);
    });

    it("refuses to draw when stock and waste are both empty", () => {
        const res = dispatch(
            solitaire,
            makeState({}),
            { type: "draw", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(false);
    });
});

describe("solitaire — moves", () => {
    it("sends an Ace from the waste up to its foundation", () => {
        const state = makeState({ waste: [suited("A", "hearts")] });
        const res = dispatch(
            solitaire,
            state,
            { type: "wasteToFoundation", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.foundations.hearts).toEqual([suited("A", "hearts")]);
        expect(res.state.waste).toHaveLength(0);
    });

    it("rejects a non-sequential foundation move", () => {
        const state = makeState({ waste: [suited("5", "hearts")] });
        const res = dispatch(
            solitaire,
            state,
            { type: "wasteToFoundation", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(false);
    });

    it("moves a descending alternating run and flips the exposed card", () => {
        // Column 0: [♣K(down)] under face-up ♥Q → move ♥Q onto ♠K in column 1.
        const tableau = Array.from({ length: 7 }, () => EMPTY_COLUMN);
        tableau[0] = {
            down: [suited("K", "clubs")],
            up: [suited("Q", "hearts")],
        };
        tableau[1] = { down: [], up: [suited("K", "spades")] };
        const state = makeState({ tableau });

        const res = dispatch(
            solitaire,
            state,
            {
                type: "tableauToTableau",
                playerId: "solo",
                from: 0,
                to: 1,
                count: 1,
            },
            "solo",
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        // ♥Q now sits on ♠K…
        expect(res.state.tableau[1].up).toEqual([
            suited("K", "spades"),
            suited("Q", "hearts"),
        ]);
        // …and the hidden ♣K flipped face-up.
        expect(res.state.tableau[0].down).toHaveLength(0);
        expect(res.state.tableau[0].up).toEqual([suited("K", "clubs")]);
    });

    it("only lets a King move onto an empty column", () => {
        const tableau = Array.from({ length: 7 }, () => EMPTY_COLUMN);
        tableau[0] = { down: [], up: [suited("9", "hearts")] };
        const state = makeState({ tableau });
        const res = dispatch(
            solitaire,
            state,
            {
                type: "tableauToTableau",
                playerId: "solo",
                from: 0,
                to: 1,
                count: 1,
            },
            "solo",
        );
        expect(res.ok).toBe(false);
    });
});

describe("solitaire — winning", () => {
    it("completes the last foundation and reports the outcome", () => {
        const tableau = Array.from({ length: 7 }, () => EMPTY_COLUMN);
        tableau[0] = { down: [], up: [suited("K", "spades")] };
        const state = makeState({
            foundations: {
                spades: pile("spades", 12), // A…Q, missing the King
                hearts: pile("hearts"),
                diamonds: pile("diamonds"),
                clubs: pile("clubs"),
            },
            tableau,
        });

        expect(solitaire.isOver(state)).toBe(false);
        const res = dispatch(
            solitaire,
            state,
            { type: "tableauToFoundation", playerId: "solo", column: 0 },
            "solo",
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("won");
        expect(solitaire.isOver(res.state)).toBe(true);
        const outcome = solitaire.outcome(res.state);
        expect(outcome?.winners).toEqual(["solo"]);
        expect(outcome?.rankings[0].rank).toBe(1);
    });
});

describe("solitaire — auto-finish", () => {
    /** Foundations one short of done, the four Kings exposed, nothing hidden. */
    function almostWon(): SolitaireState {
        const tableau = Array.from({ length: 7 }, () => EMPTY_COLUMN);
        tableau[0] = { down: [], up: [suited("K", "spades")] };
        tableau[1] = { down: [], up: [suited("K", "hearts")] };
        tableau[2] = { down: [], up: [suited("K", "diamonds")] };
        tableau[3] = { down: [], up: [suited("K", "clubs")] };
        return makeState({
            foundations: {
                spades: pile("spades", 12),
                hearts: pile("hearts", 12),
                diamonds: pile("diamonds", 12),
                clubs: pile("clubs", 12),
            },
            tableau,
            moves: 10,
        });
    }

    it("offers the finish action only when no card is still face-down", () => {
        const ready = almostWon();
        expect(
            solitaire
                .legalActions(ready, "solo")
                .some((a) => a.type === "autoFinish"),
        ).toBe(true);

        // Bury a card: the future is unknown again, so the shortcut vanishes.
        const tableau = [...ready.tableau];
        tableau[4] = {
            down: [suited("2", "hearts")],
            up: [suited("3", "clubs")],
        };
        const hidden = makeState({ ...ready, tableau });
        expect(
            solitaire
                .legalActions(hidden, "solo")
                .some((a) => a.type === "autoFinish"),
        ).toBe(false);
    });

    it("drains every loose card to the foundations and wins, counting each as a move", () => {
        const res = dispatch(
            solitaire,
            almostWon(),
            { type: "autoFinish", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("won");
        for (const suit of ["spades", "hearts", "diamonds", "clubs"] as const) {
            expect(res.state.foundations[suit]).toHaveLength(13);
        }
        expect(res.state.tableau.every((c) => c.up.length === 0)).toBe(true);
        // Four Kings moved up → four moves added to the running score.
        expect(res.state.moves).toBe(14);
        const outcome = solitaire.outcome(res.state);
        expect(outcome?.winners).toEqual(["solo"]);
    });

    it("refuses the shortcut while a card is still hidden", () => {
        const tableau = Array.from({ length: 7 }, () => EMPTY_COLUMN);
        tableau[0] = {
            down: [suited("K", "clubs")],
            up: [suited("Q", "hearts")],
        };
        const res = dispatch(
            solitaire,
            makeState({ tableau }),
            { type: "autoFinish", playerId: "solo" },
            "solo",
        );
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("illegal_move");
    });
});

describe("solitaire — view redaction", () => {
    it("leaks only counts for the stock and the hidden tableau cards", () => {
        const state = createGame(solitaire, players, 99);
        const view = solitaire.view(state, "solo");
        expect(view.stockCount).toBe(24);
        // The stock order never reaches the client — even its owner.
        expect("stock" in view).toBe(false);
        expect(view.tableau[6].downCount).toBe(6);
        expect(view.tableau[6].up).toHaveLength(1);
        expect(view.tableau[0].downCount).toBe(0);
    });
});

describe("solitaire — runner contract", () => {
    it("refuses an action from a non-actor and after the game is over", () => {
        const state = createGame(solitaire, players, 1);
        const mismatch = dispatch(
            solitaire,
            state,
            { type: "draw", playerId: "solo" },
            "intruder",
        );
        expect(mismatch.ok).toBe(false);
        if (!mismatch.ok) expect(mismatch.error.code).toBe("identity_mismatch");

        const won = makeState({ phase: "won" });
        const after = dispatch(
            solitaire,
            won,
            { type: "draw", playerId: "solo" },
            "solo",
        );
        expect(after.ok).toBe(false);
    });

    it("gives no legal actions to a spectator or once won", () => {
        const state = createGame(solitaire, players, 1);
        expect(solitaire.legalActions(state, "someone-else")).toHaveLength(0);
        expect(
            solitaire.legalActions(makeState({ phase: "won" }), "solo"),
        ).toHaveLength(0);
    });

    it("re-derives an identical state from (seed, action log)", () => {
        const actions: SolitaireAction[] = Array.from({ length: 5 }, () => ({
            type: "draw" as const,
            playerId: "solo",
        }));

        let manual = createGame(solitaire, players, 2024, "g");
        for (const action of actions) {
            const rng = createRng(manual.rngState);
            const res = solitaire.apply(manual, action, rng);
            expect(res.ok).toBe(true);
            if (res.ok) manual = res.state;
        }

        const replayed = replay(solitaire, players, 2024, actions, "g");
        expect(replayed).toEqual(manual);
    });
});
