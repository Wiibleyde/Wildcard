import { describe, expect, it } from "vitest";
import { cardKey } from "@/lib/card/utils";
import { type BatailleState, bataille } from "@/lib/games/bataille/bataille";
import {
    type PresidentAction,
    type PresidentState,
    president,
} from "@/lib/games/president/president";
import { createGame, dispatch, replay } from "./runner";
import type { Player } from "./types";

/**
 * Anti-cheat — the server re-derives every shuffle from the seed.
 *
 * A game is a pure function of `(seed, action log)`. The seed lives inside the
 * secret `game_states.state` (service-role only, never in a client `view()`),
 * so a shuffle can be reconstructed by the server and by no one else. That is
 * what makes the state server-authoritative: the server never trusts a state a
 * client claims — it recomputes it. These tests pin that guarantee.
 *
 * Engine legality (`not_your_turn`, `not_in_hand`, `identity_mismatch`,
 * `game_over`) is covered in each game's own suite and in `runner.test.ts`;
 * here we prove the determinism + secrecy that back the anti-cheat story.
 */

const TWO: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
];

const FOUR: Player[] = [
    ...TWO,
    { id: "c", name: "C", seat: 2 },
    { id: "d", name: "D", seat: 3 },
];

describe("anti-cheat — deterministic deal from the seed", () => {
    it("re-derives an identical bataille deal for a fixed seed", () => {
        const seed = 0x5eed_1234;
        const first = createGame(bataille, TWO, seed);
        const second = createGame(bataille, TWO, seed);

        for (const p of TWO) {
            expect(second.piles[p.id].draw.map(cardKey)).toEqual(
                first.piles[p.id].draw.map(cardKey),
            );
        }
    });

    it("re-derives an identical président deal for a fixed seed", () => {
        const seed = 0x5eed_1234;
        const first = createGame(president, FOUR, seed);
        const second = createGame(president, FOUR, seed);

        for (const p of FOUR) {
            expect(second.hands[p.id].map(cardKey)).toEqual(
                first.hands[p.id].map(cardKey),
            );
        }
    });

    it("produces a different deal for a different seed", () => {
        const one = createGame(president, FOUR, 1).hands.a.map(cardKey);
        const two = createGame(president, FOUR, 2).hands.a.map(cardKey);
        expect(two).not.toEqual(one);
    });
});

describe("anti-cheat — the seed never leaves the server", () => {
    // A distinctive seed we can grep for in the serialized view: if it leaked,
    // a client could pre-compute every future shuffle instead of the server.
    const SEED = 987_654_321;

    it("keeps seed and rngState out of the bataille client view", () => {
        const state = createGame(bataille, TWO, SEED);
        const view = bataille.view(state, "a");

        expect(view).not.toHaveProperty("seed");
        expect(view).not.toHaveProperty("rngState");
        expect(JSON.stringify(view)).not.toContain(String(SEED));
        expect(JSON.stringify(view)).not.toContain(String(state.rngState));
    });

    it("keeps seed and rngState out of the président client view", () => {
        const state = createGame(president, FOUR, SEED);
        const view = president.view(state, "a");

        expect(view).not.toHaveProperty("seed");
        expect(view).not.toHaveProperty("rngState");
        expect(JSON.stringify(view)).not.toContain(String(SEED));
        expect(JSON.stringify(view)).not.toContain(String(state.rngState));
    });
});

describe("anti-cheat — re-derivation exposes a forged client state", () => {
    it("rebuilds the true state from (seed, log) and rejects a tampered hand", () => {
        const seed = 20260718;
        const log: PresidentAction[] = [];
        let authoritative = createGame(president, FOUR, seed);

        // Play a handful of real turns; the server records only the action log.
        for (let i = 0; i < 6 && !president.isOver(authoritative); i++) {
            const action = president.legalActions(
                authoritative,
                authoritative.currentPlayerId,
            )[0];
            const result = dispatch(
                president,
                authoritative,
                action,
                action.playerId,
            );
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            authoritative = result.state;
        }

        // A cheating client submits a state where it holds an all-powerful hand.
        const cheater = authoritative.currentPlayerId;
        const forged: PresidentState = {
            ...authoritative,
            hands: {
                ...authoritative.hands,
                [cheater]: [{ type: "suited", suit: "hearts", rank: "2" }],
            },
        };

        // The server never trusts `forged`: it re-derives from (seed, log).
        const rederived = replay(
            president,
            FOUR,
            seed,
            log,
            authoritative.gameId,
        );

        expect(rederived).toEqual(authoritative); // matches the honest history
        expect(rederived).not.toEqual(forged); // the forgery is detected
        expect(rederived.hands[cheater]).not.toEqual(forged.hands[cheater]);
    });
});

describe("anti-cheat — dispatch is the single server chokepoint", () => {
    it("refuses a président action whose actor is not the authenticated user", () => {
        const state = createGame(president, FOUR, 42);
        const action = president.legalActions(state, state.currentPlayerId)[0];

        // Same action, but relayed under a different authenticated identity.
        const impostor = FOUR.find((p) => p.id !== action.playerId);
        if (!impostor) throw new Error("no impostor available");
        const result = dispatch(president, state, action, impostor.id);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("identity_mismatch");
    });

    it("refuses any action once the game is over", () => {
        const done: BatailleState = {
            ...createGame(bataille, TWO, 7),
            phase: "done",
        };
        const result = dispatch(
            bataille,
            done,
            { type: "flip", playerId: "a" },
            "a",
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("game_over");
    });
});
