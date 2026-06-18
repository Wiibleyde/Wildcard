import { describe, expect, it } from "vitest";
import { fail, seatOrder } from "./rules";
import type { GameState, Player } from "./types";

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
    const player = (id: string, seat: number): Player => ({
        id,
        name: id,
        seat,
    });

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
