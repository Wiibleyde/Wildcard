import { describe, expect, it } from "vitest";
import {
    bindRules,
    defineRules,
    fail,
    rankByScore,
    rotateFrom,
    seatAfter,
    seatOrder,
} from "./rules";
import { type GameState, type Player, resolveRuleToggles } from "./types";

const player = (id: string, seat: number): Player => ({ id, name: id, seat });

describe("fail", () => {
    it("builds a refused ApplyResult", () => {
        const result = fail<GameState>("not_your_turn", "It is not your turn.");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe("not_your_turn");
            expect(result.error.message).toBe("It is not your turn.");
        }
    });
});

describe("seatOrder", () => {
    it("sorts players by seat ascending", () => {
        const players = [player("c", 2), player("a", 0), player("b", 1)];
        expect(seatOrder(players).map((p) => p.id)).toEqual(["a", "b", "c"]);
    });

    it("does not mutate the input array", () => {
        const players = [player("c", 2), player("a", 0)];
        seatOrder(players);
        expect(players.map((p) => p.id)).toEqual(["c", "a"]);
    });
});

describe("rotateFrom / seatAfter", () => {
    const players = [player("c", 5), player("a", 0), player("b", 2)];

    it("rotates seat order to start at a player", () => {
        expect(rotateFrom(players, "b").map((p) => p.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
        expect(rotateFrom(players, "zed").map((p) => p.id)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    it("walks seats in either direction, skipping, wrapping", () => {
        expect(seatAfter(players, "c")).toBe("a");
        expect(seatAfter(players, "a", { direction: -1 })).toBe("c");
        expect(seatAfter(players, "a", { skip: (id) => id === "b" })).toBe("c");
        expect(seatAfter(players, "a", { skip: (id) => id !== "a" })).toBe("a");
        expect(seatAfter(players, "a", { skip: () => true })).toBeNull();
    });
});

describe("rankByScore", () => {
    it("shares ranks on ties and skips past them", () => {
        const outcome = rankByScore(
            [
                { playerId: "a", score: 3 },
                { playerId: "b", score: 9 },
                { playerId: "c", score: 9 },
                { playerId: "d", score: 1 },
            ],
            { higherIsBetter: true },
        );
        expect(outcome.rankings.map((r) => [r.playerId, r.rank])).toEqual([
            ["b", 1],
            ["c", 1],
            ["a", 3],
            ["d", 4],
        ]);
        expect(outcome.winners).toEqual(["b", "c"]);
    });

    it("ranks lowest first when lower is better", () => {
        const outcome = rankByScore(
            [
                { playerId: "a", score: 3 },
                { playerId: "b", score: 1 },
            ],
            { higherIsBetter: false },
        );
        expect(outcome.winners).toEqual(["b"]);
    });
});

describe("defineRules / bindRules", () => {
    const defaults = { a: true, b: false, c: true };

    it("derives toggles in declaration order with dependencies", () => {
        expect(defineRules(defaults, { c: "a" })).toEqual([
            { key: "a", default: true },
            { key: "b", default: false },
            { key: "c", default: true, requires: "a" },
        ]);
    });

    it("fills missing keys from the defaults", () => {
        expect(bindRules({ b: true }, defaults)).toEqual({
            a: true,
            b: true,
            c: true,
        });
    });

    it("leaves legacy-optional keys absent unless named", () => {
        expect(
            bindRules({ a: false }, defaults, { legacyOptional: ["c"] }),
        ).toEqual({ a: false, b: false });
    });
});

describe("resolveRuleToggles", () => {
    it("propagates a disabled dependency through a chain", () => {
        const toggles = [
            { key: "c", default: true, requires: "b" },
            { key: "b", default: true, requires: "a" },
            { key: "a", default: true },
        ];
        expect(resolveRuleToggles(toggles, { a: false })).toEqual({
            a: false,
            b: false,
            c: false,
        });
    });
});
