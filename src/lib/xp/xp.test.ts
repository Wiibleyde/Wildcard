import { describe, expect, it } from "vitest";
import {
    BOT_ONLY_WIN_FACTOR,
    computeXpAwards,
    DEFAULT_XP_WEIGHT,
    ECA_XP_WEIGHT,
    GAME_XP_WEIGHT,
    levelForXp,
    PARTICIPATION_XP,
    WIN_XP_PER_OPPONENT,
    xpBreakdown,
    xpForLevel,
    xpProgress,
    xpWeightFor,
} from "./xp";

const rankings = (...ids: string[]) => ids.map((playerId) => ({ playerId }));

/** Président weighs 1.0 — keeps the arithmetic of the award tests readable. */
const award = (
    ids: string[],
    winners: string[],
    botIds: string[] = [],
    extra: { moduleId?: string; excluded?: string[] } = {},
) =>
    computeXpAwards({
        moduleId: extra.moduleId ?? "president",
        rankings: rankings(...ids),
        winners,
        botIds,
        excluded: extra.excluded,
    });

const amountOf = (awards: ReturnType<typeof award>, id: string) =>
    awards.find((x) => x.playerId === id)?.amount;

describe("computeXpAwards", () => {
    it("gives participation XP to a loser", () => {
        expect(amountOf(award(["a", "b"], ["a"]), "b")).toBe(PARTICIPATION_XP);
    });

    it("gives participation + one opponent's bonus to a 1v1 winner", () => {
        expect(amountOf(award(["a", "b"], ["a"]), "a")).toBe(
            PARTICIPATION_XP + WIN_XP_PER_OPPONENT,
        );
    });

    it("scales the win bonus with the number of seats", () => {
        expect(amountOf(award(["a", "b", "c", "d"], ["a"]), "a")).toBe(
            PARTICIPATION_XP + 3 * WIN_XP_PER_OPPONENT,
        );
    });

    it("filters out bots", () => {
        const awards = award(["human", "bot"], ["human"], ["bot"]);
        expect(awards).toHaveLength(1);
        expect(awards[0].playerId).toBe("human");
    });

    it("halves the win bonus when only bots sat at the table", () => {
        const awards = award(["human", "b1", "b2"], ["human"], ["b1", "b2"]);
        expect(awards[0].amount).toBe(
            PARTICIPATION_XP + 2 * WIN_XP_PER_OPPONENT * BOT_ONLY_WIN_FACTOR,
        );
    });

    it("keeps the full bonus when a second human is present beside bots", () => {
        const awards = award(["a", "b", "bot"], ["a"], ["bot"]);
        expect(amountOf(awards, "a")).toBe(
            PARTICIPATION_XP + 2 * WIN_XP_PER_OPPONENT,
        );
    });

    it("counts the deck as one opponent in a solo game (reduced bonus)", () => {
        const awards = award(["solo"], ["solo"], [], { moduleId: "president" });
        expect(awards[0].amount).toBe(
            Math.round(
                PARTICIPATION_XP + WIN_XP_PER_OPPONENT * BOT_ONLY_WIN_FACTOR,
            ),
        );
    });

    it("gives nothing to an excluded human but still counts them as human", () => {
        const awards = award(["a", "quitter", "bot"], ["a"], ["bot"], {
            excluded: ["quitter"],
        });
        expect(awards).toEqual([
            {
                playerId: "a",
                amount: PARTICIPATION_XP + 2 * WIN_XP_PER_OPPONENT,
            },
        ]);
    });

    it("returns nothing when every seat is a bot", () => {
        expect(award(["b1", "b2"], [], ["b1", "b2"])).toEqual([]);
    });

    it("awards every winner in a tie", () => {
        const awards = award(["a", "b"], ["a", "b"]);
        expect(
            awards.every(
                (x) => x.amount === PARTICIPATION_XP + WIN_XP_PER_OPPONENT,
            ),
        ).toBe(true);
    });

    it("weights the whole award by game length, rounded", () => {
        const bataille = award(["a", "b"], ["a"], [], { moduleId: "bataille" });
        expect(amountOf(bataille, "a")).toBe(
            Math.round(
                (PARTICIPATION_XP + WIN_XP_PER_OPPONENT) *
                    GAME_XP_WEIGHT.bataille,
            ),
        );
        expect(amountOf(bataille, "b")).toBe(
            Math.round(PARTICIPATION_XP * GAME_XP_WEIGHT.bataille),
        );
    });
});

describe("xpWeightFor", () => {
    it("reads native weights from the table", () => {
        expect(xpWeightFor("tarot")).toBe(GAME_XP_WEIGHT.tarot);
    });

    it("gives studio games the ECA weight", () => {
        expect(xpWeightFor("eca:1234")).toBe(ECA_XP_WEIGHT);
    });

    it("falls back to the default for an unlisted native game", () => {
        expect(xpWeightFor("belote")).toBe(DEFAULT_XP_WEIGHT);
    });

    it("never lets a quick game outweigh a long one", () => {
        expect(GAME_XP_WEIGHT.bataille).toBeLessThan(GAME_XP_WEIGHT.president);
        expect(GAME_XP_WEIGHT.president).toBeLessThan(GAME_XP_WEIGHT.tarot);
    });
});

describe("polynomial level curve", () => {
    it("level 1 starts at 0 XP", () => {
        expect(xpForLevel(1)).toBe(0);
        expect(levelForXp(0)).toBe(1);
    });

    it("follows BASE_XP · (L-1)^1.6", () => {
        expect(xpForLevel(2)).toBe(250);
        expect(xpForLevel(3)).toBe(758);
        expect(xpForLevel(4)).toBe(1450);
        expect(xpForLevel(10)).toBe(8409);
    });

    it("each level costs more than the last", () => {
        const costs = Array.from(
            { length: 60 },
            (_, i) => xpForLevel(i + 2) - xpForLevel(i + 1),
        );
        for (let i = 1; i < costs.length; i++) {
            expect(costs[i]).toBeGreaterThan(costs[i - 1]);
        }
    });

    it("keeps high levels reachable (no exponential wall)", () => {
        // Level 49 → 50 costs under 5k XP — a few dozen games, not hundreds.
        expect(xpForLevel(50) - xpForLevel(49)).toBeLessThan(5000);
    });

    it("lands on the exact level at every threshold boundary", () => {
        for (let level = 1; level <= 100; level++) {
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
        const xp = 500; // somewhere inside level 2 (250..758)
        const { level, xpIntoLevel, xpToNext } = xpBreakdown(xp);
        expect(level).toBe(2);
        expect(xpIntoLevel).toBe(xp - xpForLevel(2));
        expect(xpToNext).toBe(xpForLevel(3) - xp);
        expect(xpIntoLevel + xpToNext).toBe(xpForLevel(3) - xpForLevel(2));
    });
});
