import { describe, expect, it } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { matchesRecorded } from "./replay";

const base: GameState = {
    gameId: "g1",
    players: [{ id: "a", name: "A", seat: 0 }],
    phase: "play",
    currentPlayerId: "a",
    turn: 4,
    seed: 42,
    rngState: 7,
};

describe("matchesRecorded", () => {
    it("ignores the runner-owned turn and rng cursor", () => {
        expect(
            matchesRecorded(base, { ...base, turn: 9, rngState: 1234 }),
        ).toBe(true);
    });

    it("ignores jsonb key order", () => {
        const reordered = JSON.parse(
            JSON.stringify({ ...base, phase: undefined }),
        );
        expect(
            matchesRecorded({ ...base }, { ...reordered, phase: "play" }),
        ).toBe(true);
    });

    it("flags any other difference", () => {
        expect(matchesRecorded(base, { ...base, phase: "over" })).toBe(false);
        expect(matchesRecorded(base, { ...base, currentPlayerId: null })).toBe(
            false,
        );
    });
});
