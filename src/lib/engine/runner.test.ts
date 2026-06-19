import { describe, expect, it } from "vitest";
import { type BatailleAction, bataille } from "@/lib/games/bataille/bataille";
import {
    DEFAULT_PRESIDENT_RULES,
    type PresidentAction,
    president,
} from "@/lib/games/president/president";
import { createGame, dispatch, replay } from "./runner";
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
        let state = createGame(bataille, TWO, seed);

        for (let i = 0; i < 25 && !bataille.isOver(state); i++) {
            const action: BatailleAction = { type: "flip", playerId: "a" };
            const result = dispatch(bataille, state, action, "a");
            if (!result.ok) throw new Error(result.error.code);
            log.push(action);
            state = result.state;
        }

        expect(replay(bataille, TWO, seed, log, state.gameId)).toEqual(state);
    });

    it("re-derives a full president round, including the outcome", () => {
        const seed = 20260611;
        const log: PresidentAction[] = [];
        let state = createGame(president, FOUR, seed);

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

        const replayed = replay(president, FOUR, seed, log, state.gameId);
        expect(replayed).toEqual(state);
        expect(president.outcome(replayed)).toEqual(president.outcome(state));
    });

    // Guards the replay reconstruction (src/lib/models/replay.ts): a game played
    // under non-default table rules must replay identically when rebuilt from the
    // base module + the persisted `state.rules`. createGame re-stamps the module
    // DEFAULT rules, so without grafting the persisted ones a `revolution: false`
    // game diverges the moment a four-of-a-kind is played.
    it("re-derives a president round played under non-default rules", () => {
        const seed = 1248401141;
        const rules = { ...DEFAULT_PRESIDENT_RULES, revolution: false };
        const configured = president.withRules?.(rules);
        if (!configured) throw new Error("president.withRules unavailable");

        const log: PresidentAction[] = [];
        let state = createGame(configured, FOUR, seed);
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
            ...createGame(president, FOUR, seed, state.gameId),
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

    it("throws when the log diverges from the rules", () => {
        const seed = 7;
        const opening = createGame(president, FOUR, seed);
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
