import { describe, expect, it } from "vitest";
import type { GameAction } from "@/lib/engine/types";
import { chooseBotAction } from "./bots";

const act = (type: string): GameAction => ({ type, playerId: "bot" });

describe("chooseBotAction", () => {
    it("never takes a risky action while a safe one exists", () => {
        for (let i = 0; i < 50; i++) {
            const pick = chooseBotAction(
                [act("announceSlam"), act("pass")],
                ["announceSlam"],
            );
            expect(pick.type).toBe("pass");
        }
    });

    it("still prefers acting over passing among safe moves", () => {
        for (let i = 0; i < 50; i++) {
            expect(chooseBotAction([act("play"), act("pass")]).type).toBe(
                "play",
            );
        }
    });

    it("falls back to a risky action when it is the only legal move", () => {
        expect(
            chooseBotAction([act("announceSlam")], ["announceSlam"]).type,
        ).toBe("announceSlam");
    });
});
