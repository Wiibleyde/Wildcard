import { describe, expect, it } from "vitest";
import { rateLimit, TokenBucketLimiter } from "./rateLimit";

const policy = { capacity: 3, refillPerSecond: 1 };

function clock(start = 0) {
    let t = start;
    return {
        now: () => t,
        advance: (ms: number) => {
            t += ms;
        },
    };
}

describe("TokenBucketLimiter", () => {
    it("allows a burst up to capacity, then refuses", () => {
        const c = clock();
        const limiter = new TokenBucketLimiter(c.now);
        expect(limiter.consume("k", policy).ok).toBe(true);
        expect(limiter.consume("k", policy).ok).toBe(true);
        expect(limiter.consume("k", policy).ok).toBe(true);
        const denied = limiter.consume("k", policy);
        expect(denied).toEqual({ ok: false, retryAfterSeconds: 1 });
    });

    it("refills over time, never above capacity", () => {
        const c = clock();
        const limiter = new TokenBucketLimiter(c.now);
        for (let i = 0; i < 3; i++) limiter.consume("k", policy);
        expect(limiter.consume("k", policy).ok).toBe(false);

        c.advance(1000);
        expect(limiter.consume("k", policy).ok).toBe(true);
        expect(limiter.consume("k", policy).ok).toBe(false);

        c.advance(60_000); // long idle: back to a full bucket, not 60 tokens
        for (let i = 0; i < 3; i++) {
            expect(limiter.consume("k", policy).ok).toBe(true);
        }
        expect(limiter.consume("k", policy).ok).toBe(false);
    });

    it("keeps buckets independent per key", () => {
        const limiter = new TokenBucketLimiter(clock().now);
        for (let i = 0; i < 3; i++) limiter.consume("a", policy);
        expect(limiter.consume("a", policy).ok).toBe(false);
        expect(limiter.consume("b", policy).ok).toBe(true);
    });

    it("reports Retry-After from the refill rate", () => {
        const limiter = new TokenBucketLimiter(clock().now);
        const slow = { capacity: 1, refillPerSecond: 1 / 10 };
        limiter.consume("k", slow);
        expect(limiter.consume("k", slow)).toEqual({
            ok: false,
            retryAfterSeconds: 10,
        });
    });
});

describe("rateLimit (route guard)", () => {
    it("returns null while allowed, then a 429 rate_limited response", async () => {
        const limiter = new TokenBucketLimiter(clock().now);
        // roomCreate allows a burst of 5.
        for (let i = 0; i < 5; i++) {
            expect(rateLimit("roomCreate", "user-1", limiter)).toBeNull();
        }
        const res = rateLimit("roomCreate", "user-1", limiter);
        expect(res?.status).toBe(429);
        expect(res?.headers.get("Retry-After")).toBe("10");
        expect(await res?.json()).toEqual({ error: "rate_limited" });
        // Groups are separate budgets.
        expect(rateLimit("roomJoin", "user-1", limiter)).toBeNull();
    });
});
