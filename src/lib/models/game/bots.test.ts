import { describe, expect, it } from "vitest";
import type { GameAction } from "@/lib/engine/types";
import { chooseBotAction, isStallCandidate } from "./bots";

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

describe("isStallCandidate", () => {
    const stale = new Date(Date.now() - 10_000).toISOString();
    const base = {
        is_over: false,
        bot_ids: ["bot"],
        current_player_id: "bot" as string | null,
        updated_at: stale,
    };

    it("flags a stale game a bot may be driving", () => {
        expect(isStallCandidate(base)).toBe(true);
        expect(isStallCandidate({ ...base, current_player_id: null })).toBe(
            true,
        );
    });

    it("ignores live chains, human turns, finished and bot-less games", () => {
        const fresh = new Date().toISOString();
        expect(isStallCandidate({ ...base, updated_at: fresh })).toBe(false);
        expect(isStallCandidate({ ...base, current_player_id: "human" })).toBe(
            false,
        );
        expect(isStallCandidate({ ...base, is_over: true })).toBe(false);
        expect(isStallCandidate({ ...base, bot_ids: [] })).toBe(false);
    });
});
