/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * The whole engine draws randomness from here so a game becomes a pure
 * function of (seed, action log): same seed + same actions ⇒ identical
 * outcome. That buys us free replay, reproducible tests, and server-side
 * anti-cheat — the server can re-derive any shuffle a client claims to see.
 *
 * `state` exposes the evolving cursor: persist it into `GameState.rngState`
 * after every step so the next `apply` resumes the sequence instead of
 * re-seeding from scratch (which would repeat shuffles, e.g. on a reshuffle).
 */
export interface Rng {
    /** Float in [0, 1). */
    next(): number;
    /** Integer in [0, maxExclusive). */
    int(maxExclusive: number): number;
    /** Fisher–Yates shuffle — returns a NEW array, input left untouched. */
    shuffle<T>(items: readonly T[]): T[];
    /** Current internal cursor — store in `GameState.rngState`. */
    readonly state: number;
}

export function createRng(seed: number): Rng {
    let cursor = seed >>> 0;

    const nextUint32 = (): number => {
        cursor = (cursor + 0x6d2b79f5) | 0;
        let t = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return (t ^ (t >>> 14)) >>> 0;
    };

    const next = (): number => nextUint32() / 0x1_0000_0000;

    const int = (maxExclusive: number): number => {
        if (maxExclusive <= 0) return 0;
        return Math.floor(next() * maxExclusive);
    };

    const shuffle = <T>(items: readonly T[]): T[] => {
        const out = [...items];
        for (let i = out.length - 1; i > 0; i--) {
            const j = int(i + 1);
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };

    return {
        next,
        int,
        shuffle,
        get state() {
            return cursor >>> 0;
        },
    };
}

/** Cryptographically-random 32-bit seed for a fresh game. */
export function randomSeed(): number {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
}
