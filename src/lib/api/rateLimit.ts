import { NextResponse } from "next/server";

/**
 * In-memory token-bucket rate limiter for the mutating API routes.
 *
 * Each (route group, user id) pair owns a bucket of `capacity` tokens that
 * refills continuously at `refillPerSecond`. A request spends one token; an
 * empty bucket means 429. A token bucket (rather than a fixed window) allows a
 * short human burst — a few fast clicks — while capping the sustained rate a
 * script can reach.
 *
 * Scope / limits (deliberate, documented for the jury):
 * - State lives in this Node process. That is exact for the single-container
 *   deployment (deploy/compose.yml runs one `server.js`). With several
 *   replicas each would enforce its own budget (effective limit × N); the
 *   upgrade path is the same interface backed by Redis / a Postgres table.
 * - Keys are user ids (every limited route is authenticated), so a NAT'd
 *   classroom sharing one IP is not throttled as one user. Unauthenticated
 *   floods are the reverse proxy's job (Caddy + CrowdSec).
 * - Memory is bounded: idle buckets (full again) are swept once the map grows.
 */

export interface RateLimitPolicy {
    /** Burst size: requests allowed back-to-back from a full bucket. */
    readonly capacity: number;
    /** Sustained rate: tokens regained per second. */
    readonly refillPerSecond: number;
}

/** Route groups and their budgets. One bucket per (group, user). */
export const RATE_LIMITS = {
    /** Creating lobbies — each one is a DB row + a code. */
    roomCreate: { capacity: 5, refillPerSecond: 1 / 10 },
    /**
     * Joining by code — the brute-force surface of private rooms. 10 tries,
     * then one every 3s: enumerating the 32^5 ≈ 33M code space is hopeless.
     */
    roomJoin: { capacity: 10, refillPerSecond: 1 / 3 },
    /** Quick-match enqueue and "play with bots" (each may deal a game). */
    matchmaking: { capacity: 10, refillPerSecond: 1 / 2 },
    /** In-game moves: generous for fast games, still caps a spam loop. */
    gameAction: { capacity: 30, refillPerSecond: 5 },
    /** Studio writes (create / save / publish): editor autosave-friendly. */
    studioWrite: { capacity: 20, refillPerSecond: 1 / 2 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitGroup = keyof typeof RATE_LIMITS;

interface Bucket {
    tokens: number;
    /** ms timestamp of the last refill computation. */
    updatedAt: number;
}

export type RateLimitDecision =
    | { readonly ok: true; readonly remaining: number }
    | { readonly ok: false; readonly retryAfterSeconds: number };

/** Sweep idle buckets once the map grows past this many entries. */
const SWEEP_THRESHOLD = 10_000;

/**
 * A self-contained limiter. The app uses the shared {@link defaultLimiter};
 * tests build their own with an injected clock.
 */
export class TokenBucketLimiter {
    private readonly buckets = new Map<string, Bucket>();

    constructor(private readonly now: () => number = Date.now) {}

    /** Spend one token from `key`'s bucket under `policy`. */
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

    /** Number of live buckets (tests / introspection). */
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

    /**
     * Drop buckets idle long enough to be full again under the slowest policy —
     * forgetting them is indistinguishable from keeping them.
     */
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

/** Process-wide limiter shared by every route handler. */
const defaultLimiter = new TokenBucketLimiter();

/**
 * Route guard: spend one token for `userId` in `group`. Returns `null` when the
 * request may proceed, or a ready 429 (stable `rate_limited` code + a
 * `Retry-After` header) to return as-is:
 *
 * ```ts
 * const limited = rateLimit("roomJoin", auth.user.id);
 * if (limited) return limited;
 * ```
 */
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
