/**
 * Deterministic, seedable PRNG.
 *
 * The whole engine draws randomness from here so a game becomes a pure
 * function of (seed, action log): same seed + same actions ⇒ identical
 * outcome. That buys us free replay, reproducible tests, and server-side
 * anti-cheat — the server can re-derive any shuffle a client claims to see.
 *
 * `state` exposes the evolving cursor: persist it into `GameState.rngState`
 * after every step so the next `apply` resumes the sequence instead of
 * re-seeding from scratch (which would repeat shuffles, e.g. on a reshuffle).
 *
 * ## Two generators, one interface
 *
 * - **sfc32 (current)** — 128-bit state, seeded with 128 bits from
 *   `crypto.getRandomValues`. Serialized as `"sfc32:<32 hex chars>"` (the four
 *   32-bit words a, b, c, d, big-endian hex). The seed IS the initial state, so
 *   `createRng(seed)` and `createRng(rngState)` go through the same parser.
 * - **mulberry32 (legacy)** — a plain 32-bit `number`. Only kept so games
 *   recorded before the switch still load and replay bit-identically. Never
 *   generated for a new game: a 32-bit seed is brute-forceable (2^32 candidate
 *   deals in minutes on one core — a player knowing their own 13 cards can
 *   recover every opponent hand and the Tarot chien).
 *
 * The representation itself selects the generator (`number` ⇒ mulberry32,
 * tagged string ⇒ sfc32), so a stored game needs no migration and modules
 * never branch on it — they only see the {@link Rng} interface.
 *
 * Why sfc32 rather than xoshiro128**: xoshiro's state transition is linear
 * over GF(2), so a few full outputs determine the state by linear algebra.
 * sfc32 mixes additions with xor/rotations (non-linear) and carries a counter
 * that rules out short cycles. Neither is a CSPRNG; the threat this closes is
 * exhaustive search of the seed space, which 2^128 makes infeasible. Clients
 * never see raw outputs anyway — only a few cards, i.e. heavily reduced
 * shuffle indices — and the seed/state never leave the server.
 */
export interface Rng {
    /** Float in [0, 1). */
    next(): number;
    /** Integer in [0, maxExclusive). */
    int(maxExclusive: number): number;
    /** Fisher–Yates shuffle — returns a NEW array, input left untouched. */
    shuffle<T>(items: readonly T[]): T[];
    /** Current internal cursor — store in `GameState.rngState`. */
    readonly state: RngState;
}

/** Tag of the current 128-bit generator's serialized state. */
const SFC32_PREFIX = "sfc32:";
const SFC32_PATTERN = /^sfc32:[0-9a-f]{32}$/;

/** Serialized 128-bit sfc32 state: `"sfc32:"` + 32 lowercase hex chars. */
export type Sfc32State = `sfc32:${string}`;

/**
 * A serialized RNG cursor, JSON-safe so it lives inside the persisted state:
 * `number` = legacy mulberry32 (32-bit), {@link Sfc32State} = current sfc32.
 */
export type RngState = number | Sfc32State;

/** A game seed — the RNG state the game was dealt from (same encoding). */
export type GameSeed = RngState;

/** Runtime guard for a value read back from storage (untrusted JSON). */
export function isRngState(value: unknown): value is RngState {
    if (typeof value === "number") {
        return Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
    }
    return typeof value === "string" && SFC32_PATTERN.test(value);
}

/** True for a seed/state from before the 128-bit switch (mulberry32). */
export function isLegacyRngState(state: RngState): state is number {
    return typeof state === "number";
}

/** Shared float/int/shuffle derivation over a raw 32-bit source. */
function rngFrom(nextUint32: () => number, state: () => RngState): Rng {
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
            return state();
        },
    };
}

/** Legacy mulberry32 — kept bit-identical for games recorded before sfc32. */
function mulberry32(seed: number): Rng {
    let cursor = seed >>> 0;
    return rngFrom(
        () => {
            cursor = (cursor + 0x6d2b79f5) | 0;
            let t = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return (t ^ (t >>> 14)) >>> 0;
        },
        () => cursor >>> 0,
    );
}

const hex32 = (word: number): string =>
    (word >>> 0).toString(16).padStart(8, "0");

/** sfc32 (Chris Doty-Humphrey's Small Fast Chaotic PRNG), 128-bit state. */
function sfc32(serialized: Sfc32State): Rng {
    const body = serialized.slice(SFC32_PREFIX.length);
    let a = Number.parseInt(body.slice(0, 8), 16) | 0;
    let b = Number.parseInt(body.slice(8, 16), 16) | 0;
    let c = Number.parseInt(body.slice(16, 24), 16) | 0;
    let d = Number.parseInt(body.slice(24, 32), 16) | 0;
    return rngFrom(
        () => {
            const t = (((a + b) | 0) + d) | 0;
            d = (d + 1) | 0;
            a = b ^ (b >>> 9);
            b = (c + (c << 3)) | 0;
            c = (c << 21) | (c >>> 11);
            c = (c + t) | 0;
            return t >>> 0;
        },
        () => `${SFC32_PREFIX}${hex32(a)}${hex32(b)}${hex32(c)}${hex32(d)}`,
    );
}

/**
 * Resume (or start) a generator from a serialized seed / `rngState`. The
 * encoding picks the algorithm, so legacy numeric games keep mulberry32.
 * Throws on a malformed string rather than silently dealing from garbage.
 */
export function createRng(state: RngState): Rng {
    if (typeof state === "number") return mulberry32(state);
    if (!SFC32_PATTERN.test(state)) {
        throw new RangeError(`createRng: malformed RNG state "${state}"`);
    }
    return sfc32(state);
}

/**
 * Cryptographically-random 128-bit seed for a fresh game (sfc32 encoding).
 * Every new game uses this; numeric seeds exist only for legacy replays and
 * fixed test fixtures.
 */
export function randomSeed(): Sfc32State {
    const words = new Uint32Array(4);
    crypto.getRandomValues(words);
    return `${SFC32_PREFIX}${Array.from(words, hex32).join("")}`;
}
