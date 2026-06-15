import { describe, expect, it } from "vitest";
import { backoffDelay, classifyChannelStatus } from "./reconnect";

describe("backoffDelay", () => {
    it("doubles each attempt: 1s, 2s, 4s, 8s", () => {
        expect(backoffDelay(0)).toBe(1000);
        expect(backoffDelay(1)).toBe(2000);
        expect(backoffDelay(2)).toBe(4000);
        expect(backoffDelay(3)).toBe(8000);
    });

    it("caps at 10s so a flapping network never hammers the socket", () => {
        expect(backoffDelay(4)).toBe(10_000); // 16s → capped
        expect(backoffDelay(5)).toBe(10_000);
        expect(backoffDelay(50)).toBe(10_000);
    });

    it("never returns a non-positive delay", () => {
        for (let attempt = 0; attempt < 20; attempt++) {
            expect(backoffDelay(attempt)).toBeGreaterThan(0);
        }
    });
});

describe("classifyChannelStatus", () => {
    it("maps SUBSCRIBED to connected without a re-join", () => {
        expect(classifyChannelStatus("SUBSCRIBED")).toEqual({
            status: "connected",
            rejoin: false,
        });
    });

    it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])(
        "maps %s to reconnecting and schedules a re-join",
        (status) => {
            expect(classifyChannelStatus(status)).toEqual({
                status: "reconnecting",
                rejoin: true,
            });
        },
    );

    it("ignores intermediate/unknown statuses (no state change)", () => {
        expect(classifyChannelStatus("JOINING")).toBeNull();
        expect(classifyChannelStatus("")).toBeNull();
    });
});
