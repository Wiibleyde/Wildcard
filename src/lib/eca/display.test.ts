import { describe, expect, it } from "vitest";
import { describeEcaEvent, ecaCardLabel, isRedSuit } from "./display";

const t = (key: string, values?: Record<string, string | number>): string =>
    values ? `${key}:${JSON.stringify(values)}` : key;
const nameOf = (id: unknown): string => (id === "a" ? "Alice" : "?");

describe("ECA display helpers", () => {
    it("labels suited cards and hides anything else", () => {
        expect(
            ecaCardLabel({ type: "suited", suit: "hearts", rank: "7" }),
        ).toBe("7♥");
        expect(
            ecaCardLabel({ type: "suited", suit: "swords", rank: "7" }),
        ).toBe("?");
        expect(ecaCardLabel(null)).toBe("?");
        expect(ecaCardLabel({ type: "fool" })).toBe("?");
    });

    it("colours hearts and diamonds red", () => {
        expect(isRedSuit({ type: "suited", suit: "diamonds", rank: "K" })).toBe(
            true,
        );
        expect(isRedSuit({ type: "suited", suit: "clubs", rank: "K" })).toBe(
            false,
        );
    });

    it("narrates engine events through the given translator", () => {
        expect(
            describeEcaEvent(
                {
                    type: "cardPlayed",
                    payload: {
                        playerId: "a",
                        card: { type: "suited", suit: "spades", rank: "A" },
                    },
                },
                t,
                nameOf,
            ),
        ).toBe('log_card_played:{"name":"Alice","card":"A♠"}');
        expect(
            describeEcaEvent(
                { type: "cardsDrawn", payload: { playerId: "b" } },
                t,
                nameOf,
            ),
        ).toBe('log_cards_drawn:{"name":"?","count":1}');
        expect(describeEcaEvent({ type: "gameEnded" }, t, nameOf)).toBe(
            "log_game_ended",
        );
        expect(describeEcaEvent({ type: "unknown" }, t, nameOf)).toBeNull();
    });
});
