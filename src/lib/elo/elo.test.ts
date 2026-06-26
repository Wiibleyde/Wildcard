import { describe, expect, it } from "vitest";
import { computeEloUpdates, DEFAULT_K, type EloParticipant } from "./elo";

describe("computeEloUpdates", () => {
    it("returns nothing for fewer than two participants", () => {
        expect(computeEloUpdates([])).toEqual([]);
        expect(
            computeEloUpdates([{ playerId: "a", rating: 1000, rank: 1 }]),
        ).toEqual([]);
    });

    it("moves equal-rated players by ±K/2 in a head-to-head", () => {
        // Two 1000 players: expected 0.5 each. Winner +K(1-0.5)=+16, loser -16.
        const [winner, loser] = computeEloUpdates([
            { playerId: "w", rating: 1000, rank: 1 },
            { playerId: "l", rating: 1000, rank: 2 },
        ]);
        expect(winner.delta).toBe(DEFAULT_K / 2);
        expect(loser.delta).toBe(-DEFAULT_K / 2);
        expect(winner.after).toBe(1016);
        expect(loser.after).toBe(984);
    });

    it("is zero-sum at equal ratings (deltas cancel)", () => {
        const updates = computeEloUpdates([
            { playerId: "a", rating: 1000, rank: 1 },
            { playerId: "b", rating: 1000, rank: 2 },
            { playerId: "c", rating: 1000, rank: 3 },
        ]);
        const sum = updates.reduce((acc, u) => acc + u.delta, 0);
        // Rounding can leave a ±1 residue, but never a real drift.
        expect(Math.abs(sum)).toBeLessThanOrEqual(1);
    });

    it("rewards an underdog win more than a favourite win", () => {
        const underdog = computeEloUpdates([
            { playerId: "weak", rating: 800, rank: 1 },
            { playerId: "strong", rating: 1200, rank: 2 },
        ]);
        const favourite = computeEloUpdates([
            { playerId: "strong", rating: 1200, rank: 1 },
            { playerId: "weak", rating: 800, rank: 2 },
        ]);
        const underdogGain = underdog.find((u) => u.playerId === "weak")?.delta;
        const favouriteGain = favourite.find(
            (u) => u.playerId === "strong",
        )?.delta;
        expect(underdogGain).toBeGreaterThan(favouriteGain ?? 0);
    });

    it("treats tied ranks as a draw (0.5 each pairing)", () => {
        const updates = computeEloUpdates([
            { playerId: "a", rating: 1000, rank: 1 },
            { playerId: "b", rating: 1000, rank: 1 },
        ]);
        expect(updates.every((u) => u.delta === 0)).toBe(true);
    });

    it("ranks a 4-player table so 1st gains most and last loses most", () => {
        const table: EloParticipant[] = [
            { playerId: "p1", rating: 1000, rank: 1 },
            { playerId: "p2", rating: 1000, rank: 2 },
            { playerId: "p3", rating: 1000, rank: 3 },
            { playerId: "p4", rating: 1000, rank: 4 },
        ];
        const updates = computeEloUpdates(table);
        const byId = new Map(updates.map((u) => [u.playerId, u.delta]));
        expect(byId.get("p1")).toBeGreaterThan(byId.get("p2") ?? 0);
        expect(byId.get("p2")).toBeGreaterThan(byId.get("p3") ?? 0);
        expect(byId.get("p3")).toBeGreaterThan(byId.get("p4") ?? 0);
        expect(byId.get("p1")).toBeGreaterThan(0);
        expect(byId.get("p4")).toBeLessThan(0);
    });

    it("never drives a rating below zero", () => {
        const [loser] = computeEloUpdates([
            { playerId: "broke", rating: 5, rank: 2 },
            { playerId: "winner", rating: 2000, rank: 1 },
        ]);
        expect(loser.after).toBeGreaterThanOrEqual(0);
        expect(loser.after).toBe(Math.max(0, loser.before + loser.delta));
    });
});
