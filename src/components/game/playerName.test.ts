import { describe, expect, it } from "vitest";
import { localizePlayers, type NameLabels } from "./playerName";

const labels: NameLabels = {
    bot: (n) => `Computer ${n}`,
    unknown: (tag) => `Player ${tag}`,
};

describe("localizePlayers", () => {
    it("names bots by their bot_ids index, whatever the stored name", () => {
        const players = [
            { userId: "b2", username: "Bot 2" },
            { userId: "b1", username: "Ordinateur 1" },
        ];
        expect(
            localizePlayers(players, ["b1", "b2"], labels).map(
                (p) => p.username,
            ),
        ).toEqual(["Computer 2", "Computer 1"]);
    });

    it("localizes the stored #tag fallback and keeps real pseudos", () => {
        const players = [
            { userId: "abcd-1234", username: "#abcd" },
            { userId: "efgh-5678", username: "alice" },
        ];
        expect(
            localizePlayers(players, [], labels).map((p) => p.username),
        ).toEqual(["Player abcd", "alice"]);
    });
});
