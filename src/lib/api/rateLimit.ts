import { NextResponse } from "next/server";

/**
 * In-memory token bucket per (route group, user id). Exact for the single
 * container deployment; several replicas would each enforce their own budget
 * (the upgrade path is the same interface on Redis / Postgres).
 * Unauthenticated floods are the reverse proxy's job.
 */

export interface RateLimitPolicy {
    /** Burst size. */
    readonly capacity: number;
    /** Sustained rate, tokens per second. */
    readonly refillPerSecond: number;
}

export const RATE_LIMITS = {
    roomCreate: { capacity: 5, refillPerSecond: 1 / 10 },
    /** Brute-force surface of private rooms: 32^5 ≈ 33M codes at one try per 3s. */
    roomJoin: { capacity: 10, refillPerSecond: 1 / 3 },
    /** Shared by every `/rooms/[code]/*` route, so none of them is a code oracle. */
    roomCode: { capacity: 20, refillPerSecond: 1 / 2 },
    matchmaking: { capacity: 10, refillPerSecond: 1 / 2 },
    gameAction: { capacity: 30, refillPerSecond: 5 },
    studioWrite: { capacity: 20, refillPerSecond: 1 / 2 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitGroup = keyof typeof RATE_LIMITS;

interface Bucket {
    tokens: number;
    updatedAt: number;
}

export type RateLimitDecision =
    | { readonly ok: true; readonly remaining: number }
    | { readonly ok: false; readonly retryAfterSeconds: number };

const SWEEP_THRESHOLD = 10_000;

export class TokenBucketLimiter {
    private readonly buckets = new Map<string, Bucket>();

    constructor(private readonly now: () => number = Date.now) {}

    consume(key: string, policy: RateLimitPolicy): RateLimitDecision {
        const now = this.now();
        const bucket = this.refilled(key, policy, now);

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { ok: true, remaining: Math.floor(bucket.tokens) };
        }
        const missing = 1 - bucket.tokens;
        return {
            ok: false,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil(missing / policy.refillPerSecond),
            ),
        };
    }

    get size(): number {
        return this.buckets.size;
    }

    private refilled(
        key: string,
        policy: RateLimitPolicy,
        now: number,
    ): Bucket {
        let bucket = this.buckets.get(key);
        if (!bucket) {
            if (this.buckets.size >= SWEEP_THRESHOLD) this.sweep(now, policy);
            bucket = { tokens: policy.capacity, updatedAt: now };
            this.buckets.set(key, bucket);
            return bucket;
        }
        const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
        bucket.tokens = Math.min(
            policy.capacity,
            bucket.tokens + elapsedSeconds * policy.refillPerSecond,
        );
        bucket.updatedAt = now;
        return bucket;
    }

    /** A bucket idle long enough to be full again is indistinguishable from none. */
    private sweep(now: number, fallback: RateLimitPolicy): void {
        const slowest = Math.min(
            fallback.refillPerSecond,
            ...Object.values(RATE_LIMITS).map((p) => p.refillPerSecond),
        );
        const maxCapacity = Math.max(
            fallback.capacity,
            ...Object.values(RATE_LIMITS).map((p) => p.capacity),
        );
        const idleMs = (maxCapacity / slowest) * 1000;
        for (const [key, bucket] of this.buckets) {
            if (now - bucket.updatedAt >= idleMs) this.buckets.delete(key);
        }
    }
}

const defaultLimiter = new TokenBucketLimiter();

/** `null` when allowed, else a ready 429 `rate_limited` with `Retry-After`. */
export function rateLimit(
    group: RateLimitGroup,
    userId: string,
    limiter: TokenBucketLimiter = defaultLimiter,
): NextResponse | null {
    const decision = limiter.consume(`${group}:${userId}`, RATE_LIMITS[group]);
    if (decision.ok) return null;
    return NextResponse.json(
        { error: "rate_limited" },
        {
            status: 429,
            headers: { "Retry-After": String(decision.retryAfterSeconds) },
        },
    );
}
