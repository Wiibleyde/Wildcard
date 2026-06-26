import { describe, expect, it } from "vitest";
import {
    computeXpAwards,
    levelForXp,
    PARTICIPATION_XP,
    WIN_XP,
    xpBreakdown,
    xpForLevel,
    xpProgress,
} from "./xp";

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

describe("exponential level curve", () => {
    it("level 1 starts at 0 XP", () => {
        expect(xpForLevel(1)).toBe(0);
        expect(levelForXp(0)).toBe(1);
    });

    it("each level costs GROWTH× more than the last", () => {
        // 1→2: 300, 2→3: 360, 3→4: 432
        expect(xpForLevel(2)).toBe(300);
        expect(xpForLevel(3)).toBe(660);
        expect(xpForLevel(4)).toBe(1092);
    });

    it("the curve is strictly increasing and accelerating", () => {
        const costs = [1, 2, 3, 4, 5, 6].map(
            (l) => xpForLevel(l + 1) - xpForLevel(l),
        );
        for (let i = 1; i < costs.length; i++) {
            expect(costs[i]).toBeGreaterThan(costs[i - 1]);
        }
    });

    it("lands on the exact level at every threshold boundary", () => {
        for (let level = 1; level <= 30; level++) {
            const at = xpForLevel(level);
            expect(levelForXp(at)).toBe(level);
            expect(levelForXp(at - 1)).toBe(Math.max(1, level - 1));
            expect(levelForXp(at + 1)).toBe(level);
        }
    });

    it("reports progress 0 at a threshold and ~1 just before the next", () => {
        expect(xpProgress(xpForLevel(3))).toBe(0);
        expect(xpProgress(xpForLevel(4) - 1)).toBeGreaterThan(0.99);
    });

    it("breakdown xpToNext + xpIntoLevel spans the level", () => {
        const xp = 500; // somewhere inside level 2 (300..675)
        const { level, xpIntoLevel, xpToNext } = xpBreakdown(xp);
        expect(level).toBe(2);
        expect(xpIntoLevel).toBe(xp - xpForLevel(2));
        expect(xpToNext).toBe(xpForLevel(3) - xp);
        expect(xpIntoLevel + xpToNext).toBe(xpForLevel(3) - xpForLevel(2));
    });
});
