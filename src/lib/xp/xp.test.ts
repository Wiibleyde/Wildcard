import { describe, expect, it } from "vitest";
import { computeXpAwards, PARTICIPATION_XP, WIN_XP } from "./xp";

const rankings = (...ids: string[]) => ids.map((playerId) => ({ playerId }));

describe("computeXpAwards", () => {
    it("gives participation XP to a loser", () => {
        const awards = computeXpAwards(rankings("a", "b"), ["a"], []);
        const b = awards.find((x) => x.playerId === "b");
        expect(b?.amount).toBe(PARTICIPATION_XP);
    });

    it("gives participation + win bonus to the winner", () => {
        const awards = computeXpAwards(rankings("a", "b"), ["a"], []);
        const a = awards.find((x) => x.playerId === "a");
        expect(a?.amount).toBe(PARTICIPATION_XP + WIN_XP);
    });

    it("filters out bots", () => {
        const awards = computeXpAwards(
            rankings("human", "bot"),
            ["human"],
            ["bot"],
        );
        expect(awards).toHaveLength(1);
        expect(awards[0].playerId).toBe("human");
    });

    it("still awards a solo human who beat only bots", () => {
        // Distinct from ELO: participation XP is earned even vs bots.
        const awards = computeXpAwards(
            rankings("human", "b1", "b2"),
            ["human"],
            ["b1", "b2"],
        );
        expect(awards).toHaveLength(1);
        expect(awards[0].amount).toBe(PARTICIPATION_XP + WIN_XP);
    });

    it("returns nothing when every seat is a bot", () => {
        expect(computeXpAwards(rankings("b1", "b2"), [], ["b1", "b2"])).toEqual(
            [],
        );
    });

    it("awards every winner in a tie", () => {
        const awards = computeXpAwards(rankings("a", "b"), ["a", "b"], []);
        expect(
            awards.every((x) => x.amount === PARTICIPATION_XP + WIN_XP),
        ).toBe(true);
    });
});
