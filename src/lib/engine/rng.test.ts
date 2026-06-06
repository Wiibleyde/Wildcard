import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
    it("is deterministic for a given seed", () => {
        const a = createRng(123);
        const b = createRng(123);
        const seqA = Array.from({ length: 10 }, () => a.next());
        const seqB = Array.from({ length: 10 }, () => b.next());
        expect(seqA).toEqual(seqB);
    });

    it("produces different sequences for different seeds", () => {
        expect(createRng(1).next()).not.toEqual(createRng(2).next());
    });

    it("next() stays within [0, 1)", () => {
        const r = createRng(42);
        for (let i = 0; i < 1000; i++) {
            const v = r.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it("int(n) stays within [0, n) and is integral", () => {
        const r = createRng(7);
        for (let i = 0; i < 1000; i++) {
            const v = r.int(6);
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(6);
        }
    });

    it("shuffle is a permutation and never mutates its input", () => {
        const input = Array.from({ length: 52 }, (_, i) => i);
        const frozen = [...input];
        const out = createRng(99).shuffle(input);

        expect(input).toEqual(frozen); // input untouched
        expect(out).toHaveLength(input.length);
        expect([...out].sort((x, y) => x - y)).toEqual(frozen); // same multiset
        expect(out).not.toEqual(frozen); // actually reordered (for this seed)
    });

    it("shuffle is deterministic for a given seed", () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8];
        expect(createRng(5).shuffle(items)).toEqual(
            createRng(5).shuffle(items),
        );
    });

    it("state advances and can resume a sequence", () => {
        const original = createRng(2024);
        original.next();
        original.next();

        const resumed = createRng(original.state);
        const fresh = createRng(2024);
        fresh.next();
        fresh.next();

        expect(resumed.next()).toEqual(fresh.next());
    });
});
