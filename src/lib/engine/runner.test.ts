import { describe, expect, it } from "vitest";
import { type BatailleAction, bataille } from "@/lib/games/bataille/bataille";
import {
    DEFAULT_PRESIDENT_RULES,
    type PresidentAction,
    president,
} from "@/lib/games/president/president";
import { type Rng, randomSeed } from "./rng";
import { createGame, dispatch, replay, replayFrames } from "./runner";
import type { Player } from "./types";

const TWO: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
];

const FOUR: Player[] = [
    ...TWO,
    { id: "c", name: "C", seat: 2 },
    { id: "d", name: "D", seat: 3 },
];

describe("replay", () => {
    it("re-derives the exact bataille state from (seed, action log)", () => {
        const seed = 424242;
        const log: BatailleAction[] = [];
        let state = createGame(bataille, TWO, { seed });

        for (let i = 0; i < 25 && !bataille.isOver(state); i++) {
            const action: BatailleAction = { type: "flip", playerId: "a" };
            const result = dispatch(bataille, state, action, "a");
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            state = result.state;
        }

        expect(
            replay(bataille, TWO, seed, log, { gameId: state.gameId }),
        ).toEqual(state);
    });

    it("re-derives a full president round, including the outcome", () => {
        const seed = 20260611;
        const log: PresidentAction[] = [];
        let state = createGame(president, FOUR, { seed });

        let guard = 0;
        while (!president.isOver(state) && guard++ < 10_000) {
            const action = president.legalActions(
                state,
                state.currentPlayerId,
            )[0];
            const result = dispatch(president, state, action, action.playerId);
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            state = result.state;
        }

        const replayed = replay(president, FOUR, seed, log, {
            gameId: state.gameId,
        });
        expect(replayed).toEqual(state);
        expect(president.outcome(replayed)).toEqual(president.outcome(state));
    });

    // Guards the replay reconstruction (src/lib/models/replay.ts): a game played
    // under non-default table rules must replay identically when rebuilt from the
    // base module + the persisted `state.rules`. createGame re-stamps the module
    // DEFAULT rules, so without grafting the persisted ones a `revolution: true`
    // game diverges the moment a four-of-a-kind is played.
    it("re-derives a president round played under non-default rules", () => {
        const seed = 1248401141;
        const rules = { ...DEFAULT_PRESIDENT_RULES, revolution: true };
        const configured = president.withRules?.(rules);
        if (!configured) throw new Error("president.withRules unavailable");

        const log: PresidentAction[] = [];
        let state = createGame(configured, FOUR, { seed });
        let guard = 0;
        while (!configured.isOver(state) && guard++ < 10_000) {
            const action = configured.legalActions(
                state,
                state.currentPlayerId,
            )[0];
            const result = dispatch(configured, state, action, action.playerId);
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            state = result.state;
        }

        // Reconstruct the way the replay model does: base module, default-rules
        // deal, then graft the persisted rules back on before folding the log.
        let rebuilt = {
            ...createGame(president, FOUR, { seed, gameId: state.gameId }),
            rules,
        };
        for (const action of log) {
            const result = dispatch(
                president,
                rebuilt,
                action,
                action.playerId,
            );
            if (!result.ok) throw new Error(result.error.code);
            rebuilt = result.state;
        }

        expect(rebuilt).toEqual(state);
    });

    it("replay(..., { rules }) re-derives a configured game directly", () => {
        const seed = randomSeed();
        const rules = { ...DEFAULT_PRESIDENT_RULES, revolution: true };
        const configured = president.withRules?.(rules);
        if (!configured) throw new Error("president.withRules unavailable");

        const log: PresidentAction[] = [];
        let state = createGame(configured, FOUR, { seed });
        let guard = 0;
        while (!configured.isOver(state) && guard++ < 10_000) {
            const action = configured.legalActions(
                state,
                state.currentPlayerId,
            )[0];
            const result = dispatch(configured, state, action, action.playerId);
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            state = result.state;
        }

        // The BASE module + persisted rules is enough: replay binds them.
        expect(
            replay(president, FOUR, seed, log, {
                gameId: state.gameId,
                rules,
            }),
        ).toEqual(state);
        // createGame accepts the same rules option for the deal itself.
        expect(
            createGame(president, FOUR, { seed, gameId: "g", rules }).rules,
        ).toEqual(rules);
    });

    it("throws when the log diverges from the rules", () => {
        const seed = 7;
        const opening = createGame(president, FOUR, { seed });
        // A pass on the opening lead is always illegal in président.
        const bad: PresidentAction = {
            type: "pass",
            playerId: opening.currentPlayerId,
        };
        expect(() => replay(president, FOUR, seed, [bad])).toThrow(
            /diverged at action 0/,
        );
    });
});

describe("replayFrames", () => {
    it("yields the opening deal then one frame per action", () => {
        const seed = randomSeed();
        const log: BatailleAction[] = [];
        let state = createGame(bataille, TWO, { seed, gameId: "g" });
        const states = [state];
        for (let i = 0; i < 10 && !bataille.isOver(state); i++) {
            const action: BatailleAction = { type: "flip", playerId: "a" };
            const result = dispatch(bataille, state, action, "a");
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            state = result.state;
            states.push(state);
        }

        const frames = [
            ...replayFrames(bataille, TWO, seed, log, { gameId: "g" }),
        ];
        expect(frames.map((f) => f.index)).toEqual(states.map((_, i) => i - 1));
        expect(frames.map((f) => f.state)).toEqual(states);
        expect(frames[0].action).toBeNull();
    });

    it("returns the divergence instead of throwing", () => {
        const seed = 7;
        const opening = createGame(president, FOUR, { seed });
        const bad: PresidentAction = {
            type: "pass",
            playerId: opening.currentPlayerId,
        };
        const it = replayFrames(president, FOUR, seed, [bad]);
        expect(it.next().value).toMatchObject({ index: -1 });
        const end = it.next();
        expect(end.done).toBe(true);
        expect(end.value).toMatchObject({ index: 0, action: bad });
    });
});

describe("createGame", () => {
    it("defaults to a 128-bit seed and keeps a legacy numeric one as-is", () => {
        const fresh = createGame(bataille, TWO);
        expect(fresh.seed).toMatch(/^sfc32:[0-9a-f]{32}$/);
        expect(typeof fresh.rngState).toBe("string");

        const legacy = createGame(bataille, TWO, { seed: 424242 });
        expect(legacy.seed).toBe(424242);
        expect(typeof legacy.rngState).toBe("number");
    });

    it("accepts an explicit game id", () => {
        expect(createGame(bataille, TWO, { gameId: "row-id" }).gameId).toBe(
            "row-id",
        );
    });

    it("pins the legacy président deal recorded before the 128-bit switch", () => {
        // Golden capture from the pre-sfc32 engine: a stored numeric-seed game
        // must keep dealing exactly this hand.
        const state = createGame(president, FOUR, {
            seed: 20260611,
            gameId: "g",
        });
        expect(
            state.hands.a.map((c) =>
                c.type === "suited" ? `${c.suit}:${c.rank}` : c.type,
            ),
        ).toEqual([
            "spades:K",
            "spades:A",
            "hearts:10",
            "spades:J",
            "hearts:6",
            "clubs:2",
            "clubs:3",
            "diamonds:A",
            "hearts:A",
            "spades:8",
            "diamonds:3",
            "spades:10",
            "diamonds:7",
        ]);
        expect(state.rngState).toBe(3235803858);
        expect(state.currentPlayerId).toBe("c");
    });
});

describe("dispatch", () => {
    it("always persists the advanced RNG cursor, even if the module forgets", () => {
        const state = createGame(bataille, TWO, { seed: randomSeed() });
        const forgetful = {
            ...bataille,
            // A module that applies but drops rng.state on the floor.
            apply: (s: typeof state, a: BatailleAction, rng: Rng) => {
                rng.shuffle([1, 2, 3]);
                const r = bataille.apply(s, a, rng);
                return r.ok
                    ? { ...r, state: { ...r.state, rngState: s.rngState } }
                    : r;
            },
        };
        const result = dispatch(
            forgetful,
            state,
            { type: "flip", playerId: "a" },
            "a",
        );
        if (!result.ok) throw new Error(result.error.code);
        expect(result.state.rngState).not.toEqual(state.rngState);
    });

    it("owns the turn counter: +1 per applied action", () => {
        const state = createGame(bataille, TWO, { seed: 1 });
        const careless = {
            ...bataille,
            apply: (s: typeof state, a: BatailleAction, rng: Rng) => {
                const r = bataille.apply(s, a, rng);
                return r.ok ? { ...r, state: { ...r.state, turn: 99 } } : r;
            },
        };
        const result = dispatch(
            careless,
            state,
            { type: "flip", playerId: "a" },
            "a",
        );
        if (!result.ok) throw new Error(result.error.code);
        expect(result.state.turn).toBe(state.turn + 1);
    });

    it("refuses an actor who is not seated (not_seated)", () => {
        const state = createGame(bataille, TWO, { seed: 1 });
        const result = dispatch(
            bataille,
            state,
            { type: "flip", playerId: "zed" },
            "zed",
        );
        expect(result).toMatchObject({
            ok: false,
            error: { code: "not_seated" },
        });
    });
});
