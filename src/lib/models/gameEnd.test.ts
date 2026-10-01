import { describe, expect, it } from "vitest";
import type { GameOutcome } from "@/lib/engine/types";
import { PARTICIPATION_XP, WIN_XP } from "@/lib/xp/xp";
import {
    describeEnd,
    type EndFacts,
    outcomeFromWinners,
    playedMoves,
    resolveEndOutcome,
} from "./gameEnd";

const players = ["alice", "bob", "carol"];

describe("outcomeFromWinners", () => {
    it("ranks winners first and the forfeiter last (competition ranking)", () => {
        expect(outcomeFromWinners(players, ["alice", "carol"], "bob")).toEqual({
            rankings: [
                { playerId: "alice", rank: 1 },
                { playerId: "carol", rank: 1 },
                { playerId: "bob", rank: 3 },
            ],
            winners: ["alice", "carol"],
        });
    });

    it("puts the forfeiter behind non-winners", () => {
        const outcome = outcomeFromWinners(players, ["alice"], "bob");
        expect(outcome?.rankings).toEqual([
            { playerId: "alice", rank: 1 },
            { playerId: "carol", rank: 2 },
            { playerId: "bob", rank: 3 },
        ]);
    });

    it("returns null without winners (solo forfeit)", () => {
        expect(outcomeFromWinners(["alice"], [], "alice")).toBeNull();
    });
});

const forfeitFacts: EndFacts = {
    reason: "forfeit",
    terminal: false,
    stateOutcome: null,
    playerIds: players,
    winnerIds: ["alice", "carol"],
    forfeitedBy: "bob",
};

describe("resolveEndOutcome", () => {
    it("uses the module outcome for a terminal state", () => {
        const stateOutcome: GameOutcome = {
            rankings: [{ playerId: "alice", rank: 1 }],
            winners: ["alice"],
        };
        expect(
            resolveEndOutcome({
                ...forfeitFacts,
                reason: "natural",
                terminal: true,
                stateOutcome,
            }),
        ).toBe(stateOutcome);
    });

    it("rebuilds a forfeit from the stored winners (settlement retry)", () => {
        expect(resolveEndOutcome(forfeitFacts)?.winners).toEqual([
            "alice",
            "carol",
        ]);
    });

    it("has no outcome for an admin or reaper close", () => {
        expect(
            resolveEndOutcome({ ...forfeitFacts, reason: "admin" }),
        ).toBeNull();
        expect(
            resolveEndOutcome({ ...forfeitFacts, reason: "abandoned" }),
        ).toBeNull();
    });
});

describe("playedMoves", () => {
    it("counts every version bump of a natural end", () => {
        expect(playedMoves(7, true)).toBe(7);
        expect(playedMoves(0, true)).toBe(0);
    });

    it("discounts the out-of-band end's own bump", () => {
        expect(playedMoves(7, false)).toBe(6);
        expect(playedMoves(1, false)).toBe(0);
    });
});

describe("describeEnd", () => {
    const outcome = resolveEndOutcome(forfeitFacts);
    const base = { ...forfeitFacts, outcome, botIds: [], version: 5 };

    it("tells a remaining player they won by forfeit, with XP", () => {
        expect(describeEnd({ ...base, viewerId: "alice" })).toEqual({
            reason: "forfeit",
            forfeitedBy: "bob",
            xpGained: PARTICIPATION_XP + WIN_XP,
        });
    });

    it("gives the forfeiter no XP and a spectator no XP line", () => {
        expect(describeEnd({ ...base, viewerId: "bob" }).xpGained).toBe(0);
        expect(describeEnd({ ...base, viewerId: null }).xpGained).toBeNull();
    });

    it("grants no XP for a forfeit before the first move", () => {
        expect(
            describeEnd({ ...base, version: 1, viewerId: "alice" }).xpGained,
        ).toBe(0);
    });

    it("labels a legacy terminal row as a natural end", () => {
        expect(
            describeEnd({
                ...base,
                reason: null,
                terminal: true,
                viewerId: null,
            }).reason,
        ).toBe("natural");
    });
});
