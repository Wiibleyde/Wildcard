import { describe, expect, it } from "vitest";
import {
    createRng,
    isLegacyRngState,
    isRngState,
    type RngState,
    randomSeed,
    type Sfc32State,
} from "./rng";

const SEED: Sfc32State = "sfc32:0123456789abcdeffedcba9876543210";
const deck52 = (): number[] => Array.from({ length: 52 }, (_, i) => i);
const uint32s = (state: RngState, n: number): number[] => {
    const r = createRng(state);
    return Array.from({ length: n }, () => Math.floor(r.next() * 2 ** 32));
};

// Behavioural contract, run against BOTH generators.
describe.each<[string, RngState, RngState]>([
    ["sfc32", SEED, "sfc32:00000000000000000000000000000001"],
    ["mulberry32 (legacy)", 123, 124],
])("createRng — %s", (_name, seed, otherSeed) => {
    it("is deterministic for a given seed", () => {
        expect(uint32s(seed, 10)).toEqual(uint32s(seed, 10));
    });

    it("produces different sequences for different seeds", () => {
        expect(uint32s(seed, 4)).not.toEqual(uint32s(otherSeed, 4));
    });

    it("next() stays within [0, 1)", () => {
        const r = createRng(seed);
        for (let i = 0; i < 1000; i++) {
            const v = r.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it("int(n) stays within [0, n) and is integral", () => {
        const r = createRng(seed);
        for (let i = 0; i < 1000; i++) {
            const v = r.int(6);
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(6);
        }
    });

    it("shuffle is a permutation and never mutates its input", () => {
        const input = deck52();
        const frozen = [...input];
        const out = createRng(seed).shuffle(input);

        expect(input).toEqual(frozen); // input untouched
        expect(out).toHaveLength(input.length);
        expect([...out].sort((x, y) => x - y)).toEqual(frozen); // same multiset
        expect(out).not.toEqual(frozen); // actually reordered (for this seed)
    });

    it("shuffle is deterministic for a given seed", () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8];
        expect(createRng(seed).shuffle(items)).toEqual(
            createRng(seed).shuffle(items),
        );
    });

    it("state advances, round-trips through JSON, and resumes the sequence", () => {
        const original = createRng(seed);
        original.next();
        original.next();
        expect(original.state).not.toEqual(seed);

        // The cursor is persisted inside the jsonb game state.
        const stored = JSON.parse(JSON.stringify({ s: original.state })).s;
        expect(isRngState(stored)).toBe(true);
        const resumed = createRng(stored);
        const fresh = createRng(seed);
        fresh.next();
        fresh.next();

        expect(resumed.next()).toEqual(fresh.next());
        expect(resumed.state).toEqual(fresh.state);
    });

    it("keeps the state encoding of its seed (no silent generator switch)", () => {
        const r = createRng(seed);
        r.shuffle(deck52());
        expect(typeof r.state).toBe(typeof seed);
        expect(isLegacyRngState(r.state)).toBe(typeof seed === "number");
    });
});

/**
 * Golden values captured from the mulberry32 implementation BEFORE the 128-bit
 * switch. Games already stored with a numeric seed/rngState must keep dealing
 * exactly these cards, or their replays would silently diverge.
 */
describe("legacy mulberry32 — bit-identical to the pre-sfc32 engine", () => {
    it("reproduces the recorded raw outputs and cursor", () => {
        const r = createRng(424242);
        expect(
            Array.from({ length: 5 }, () => Math.floor(r.next() * 2 ** 32)),
        ).toEqual([552796648, 1014971992, 789266110, 2765104762, 1470401852]);
        expect(r.state).toBe(568318715);
    });

    it("reproduces the recorded 52-card shuffle and follow-up draws", () => {
        const r = createRng(0x5eed_1234);
        expect(r.shuffle(deck52())).toEqual([
            17, 12, 38, 33, 35, 47, 1, 45, 4, 28, 32, 43, 27, 34, 15, 5, 20, 51,
            13, 41, 11, 44, 30, 25, 2, 23, 19, 26, 49, 24, 40, 29, 39, 18, 6, 9,
            22, 14, 7, 50, 8, 46, 16, 36, 31, 3, 37, 0, 48, 10, 42, 21,
        ]);
        expect(r.state).toBe(513170947);
        expect([r.int(6), r.int(52), r.int(1000)]).toEqual([0, 14, 345]);
        expect(r.state).toBe(1712901090);
    });

    it("reproduces seed 0", () => {
        const r = createRng(0);
        expect(r.next()).toBe(0.26642920868471265);
        expect(r.state).toBe(1831565813);
    });
});

/**
 * Golden values for sfc32 — they match the reference implementation
 * (Doty-Humphrey's SFC, 32-bit variant). Pinned so a refactor can never
 * change the deal of a game already recorded with a 128-bit seed.
 */
describe("sfc32 — pinned reference outputs", () => {
    it("matches the reference sfc32 sequence", () => {
        const r = createRng(SEED);
        expect(
            Array.from({ length: 5 }, () => Math.floor(r.next() * 2 ** 32)),
        ).toEqual([19088742, 4127578482, 1651034390, 799975818, 3224277892]);
        expect(r.state).toBe("sfc32:86c43b8eb414c6c19f5113cd76543215");
    });

    it("reproduces the pinned 52-card shuffle", () => {
        const r = createRng(SEED);
        expect(r.shuffle(deck52())).toEqual([
            14, 46, 26, 51, 18, 11, 3, 5, 47, 17, 28, 27, 8, 21, 4, 40, 38, 31,
            24, 43, 34, 39, 6, 41, 30, 1, 7, 12, 37, 10, 42, 33, 15, 20, 44, 13,
            45, 2, 50, 23, 16, 29, 22, 48, 25, 35, 32, 36, 9, 19, 49, 0,
        ]);
        expect(r.state).toBe("sfc32:e3a824949e75f699b8094c5476543243");
    });

    it("refuses a malformed state instead of dealing from garbage", () => {
        for (const bad of [
            "sfc32:",
            "sfc32:0123",
            "sfc32:0123456789ABCDEFFEDCBA9876543210", // uppercase
            "sfc32:0123456789abcdeffedcba98765432100", // 33 chars
            "x128:0123456789abcdeffedcba9876543210",
        ]) {
            expect(() => createRng(bad as Sfc32State)).toThrow(RangeError);
            expect(isRngState(bad)).toBe(false);
        }
    });
});

describe("randomSeed — 128 bits of entropy", () => {
    it("is a 128-bit sfc32 seed (32 hex chars = 128 bits)", () => {
        const seed = randomSeed();
        expect(seed).toMatch(/^sfc32:[0-9a-f]{32}$/);
        expect(isRngState(seed)).toBe(true);
        expect(isLegacyRngState(seed)).toBe(false);
    });

    it("never repeats and fills all 128 bits", () => {
        const seeds = Array.from({ length: 2000 }, () => randomSeed());
        expect(new Set(seeds).size).toBe(seeds.length);

        // Every one of the 128 bit positions must be set in some seed and clear
        // in another: a 32-bit seed zero-padded to 128 bits would leave 96
        // positions stuck. (P(false failure) ≈ 128·2^-1999.)
        const ones = new Array<number>(128).fill(0);
        for (const seed of seeds) {
            const hex = seed.slice("sfc32:".length);
            for (let bit = 0; bit < 128; bit++) {
                const nibble = Number.parseInt(hex[bit >> 2], 16);
                if ((nibble >> (3 - (bit & 3))) & 1) ones[bit]++;
            }
        }
        for (const count of ones) {
            expect(count).toBeGreaterThan(0);
            expect(count).toBeLessThan(seeds.length);
            // Each bit should be ~50% set; 2000 draws ⇒ σ ≈ 22, allow ±7σ.
            expect(Math.abs(count - seeds.length / 2)).toBeLessThan(160);
        }
    });

    it("deals through the 128-bit generator", () => {
        expect(typeof createRng(randomSeed()).state).toBe("string");
    });
});
