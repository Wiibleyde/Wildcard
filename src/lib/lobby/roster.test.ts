import { describe, expect, it } from "vitest";
import { splitRoster } from "./roster";

describe("splitRoster", () => {
    const names = new Map([
        ["a", "Alice"],
        ["b", "Bob"],
    ]);

    it("seats players with a seat and lists spectators", () => {
        const { seats, spectators } = splitRoster(
            [
                { user_id: "a", seat: 0, role: "player" },
                { user_id: "b", seat: null, role: "spectator" },
            ],
            names,
            "?",
        );
        expect(seats).toEqual([{ userId: "a", seat: 0, username: "Alice" }]);
        expect(spectators).toEqual([{ userId: "b", username: "Bob" }]);
    });

    it("drops a player row without a seat and falls back on unknown names", () => {
        const { seats, spectators } = splitRoster(
            [
                { user_id: "a", seat: null, role: "player" },
                { user_id: "c", seat: 1, role: "player" },
            ],
            names,
            "?",
        );
        expect(seats).toEqual([{ userId: "c", seat: 1, username: "?" }]);
        expect(spectators).toEqual([]);
    });
});
