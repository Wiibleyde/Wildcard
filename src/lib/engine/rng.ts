/**
 * Deterministic, seedable PRNG: a game is a pure function of (seed, action
 * log), which buys replay, reproducible tests and server-side anti-cheat.
 *
 * The encoding selects the generator, so stored games need no migration:
 * - `"sfc32:<32 hex>"` — 128-bit sfc32, seeded from `crypto.getRandomValues`.
 *   Its non-linear mixing resists recovering the state from outputs, unlike
 *   xoshiro's GF(2)-linear transition.
 * - `number` — legacy 32-bit mulberry32, kept bit-identical for old games.
 *   Never used for new ones: 2^32 seeds are brute-forceable in minutes from
 *   a player's own hand.
 */
export interface Rng {
    /** Float in [0, 1). */
    next(): number;
    /** Integer in [0, maxExclusive). */
    int(maxExclusive: number): number;
    /** Fisher–Yates; returns a new array. */
    shuffle<T>(items: readonly T[]): T[];
    readonly state: RngState;
}

const SFC32_PREFIX = "sfc32:";
const SFC32_PATTERN = /^sfc32:[0-9a-f]{32}$/;

export type Sfc32State = `sfc32:${string}`;

/** JSON-safe cursor persisted in the state. */
export type RngState = number | Sfc32State;

/** The RNG state the game was dealt from (same encoding). */
export type GameSeed = RngState;

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

/** sfc32 (Chris Doty-Humphrey's Small Fast Chaotic PRNG). */
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

/** Throws on a malformed string rather than dealing from garbage. */
export function createRng(state: RngState): Rng {
    if (typeof state === "number") return mulberry32(state);
    if (!SFC32_PATTERN.test(state)) {
        throw new RangeError(`createRng: malformed RNG state "${state}"`);
    }
    return sfc32(state);
}

export function randomSeed(): Sfc32State {
    const words = new Uint32Array(4);
    crypto.getRandomValues(words);
    return `${SFC32_PREFIX}${Array.from(words, hex32).join("")}`;
}
