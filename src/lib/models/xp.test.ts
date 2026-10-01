import { describe, expect, it } from "vitest";
import type { GameOutcome } from "@/lib/engine/types";
import { PARTICIPATION_XP, WIN_XP } from "@/lib/xp/xp";
import { xpAwardsForGame } from "./xp";

const twoPlayers: GameOutcome = {
    rankings: [
        { playerId: "alice", rank: 1 },
        { playerId: "bob", rank: 2 },
    ],
    winners: ["alice"],
};

describe("xpAwardsForGame", () => {
    it("grants participation + win bonus for a played, won game", () => {
        expect(xpAwardsForGame(twoPlayers, [], { moveCount: 12 })).toEqual([
            { user_id: "alice", amount: PARTICIPATION_XP + WIN_XP },
            { user_id: "bob", amount: PARTICIPATION_XP },
        ]);
    });

    it("grants nothing without an outcome (admin / reaper close)", () => {
        expect(xpAwardsForGame(null, [], { moveCount: 12 })).toEqual([]);
    });

    it("grants nothing when the outcome has no winner (solo resign)", () => {
        const resigned: GameOutcome = {
            rankings: [{ playerId: "alice", rank: 1 }],
            winners: [],
        };
        expect(xpAwardsForGame(resigned, [], { moveCount: 1 })).toEqual([]);
    });

    it("grants nothing for a game nobody played (over at the deal)", () => {
        expect(xpAwardsForGame(twoPlayers, [], { moveCount: 0 })).toEqual([]);
    });

    it("skips bots and the forfeiter", () => {
        const forfeit: GameOutcome = {
            rankings: [
                { playerId: "alice", rank: 1 },
                { playerId: "bot-1", rank: 1 },
                { playerId: "bob", rank: 2 },
            ],
            winners: ["alice", "bot-1"],
        };
        expect(
            xpAwardsForGame(forfeit, ["bot-1"], {
                excluded: ["bob"],
                moveCount: 3,
            }),
        ).toEqual([{ user_id: "alice", amount: PARTICIPATION_XP + WIN_XP }]);
    });
});
