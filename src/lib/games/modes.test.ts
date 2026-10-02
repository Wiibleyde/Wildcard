import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { createRng } from "@/lib/engine/rng";
import { createGame, dispatch } from "@/lib/engine/runner";
import {
    matchRuleMode,
    type Player,
    resolveRuleToggles,
    ruleModeValues,
} from "@/lib/engine/types";
import { type BatailleState, bataille } from "./bataille/bataille";
import { GAMES } from "./index";
import { type SolitaireState, solitaire } from "./solitaire/solitaire";

describe("rule modes (launch presets)", () => {
    const configurable = Object.values(GAMES).filter((m) => m.ruleModes);

    it("every native game offers at least two modes", () => {
        expect(configurable.map((m) => m.id).sort()).toEqual([
            "bataille",
            "president",
            "solitaire",
            "tarot",
        ]);
        for (const m of configurable) {
            expect(m.ruleModes?.length).toBeGreaterThanOrEqual(2);
        }
    });

    it("the first mode is the default and matches the toggle defaults", () => {
        for (const m of configurable) {
            const defaults = resolveRuleToggles(m.ruleToggles, {});
            expect(matchRuleMode(m.ruleModes, m.ruleToggles, defaults)).toBe(
                m.ruleModes?.[0],
            );
        }
    });

    it("modes only name declared toggles, are distinct and round-trip", () => {
        const keys = new Set<string>();
        for (const m of configurable) {
            const toggleKeys = new Set(m.ruleToggles?.map((t) => t.key));
            const seen = new Set<string>();
            for (const mode of m.ruleModes ?? []) {
                expect(keys.has(mode.key)).toBe(false);
                keys.add(mode.key);
                for (const k of Object.keys(mode.rules)) {
                    expect(toggleKeys.has(k)).toBe(true);
                }
                const values = ruleModeValues(m.ruleToggles, mode);
                const id = JSON.stringify(values);
                expect(seen.has(id)).toBe(false);
                seen.add(id);
                expect(matchRuleMode(m.ruleModes, m.ruleToggles, values)).toBe(
                    mode,
                );
            }
        }
    });

    it("a hand-tweaked rule set matches no mode (custom)", () => {
        const m = GAMES.president;
        const rules = resolveRuleToggles(m.ruleToggles, {
            twoClosesTrick: false,
        });
        expect(matchRuleMode(m.ruleModes, m.ruleToggles, rules)).toBeNull();
    });
});

const duo: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
];

function card(rank: Rank): CardDescriptor {
    return { type: "suited", suit: "spades", rank };
}

describe("Bataille — War (anglaise)", () => {
    /** A forced tie on the first flip, then a decisive flip after the stake. */
    function tieState(threeCardWar: boolean): BatailleState {
        const base = createGame(bataille, duo, {
            seed: 1,
            rules: { threeCardWar },
        });
        // Stacks read bottom → top; the 10s tie, then each side stakes.
        const a = [card("A"), card("3"), card("3"), card("3"), card("10")];
        const b = [card("2"), card("4"), card("4"), card("4"), card("10")];
        return {
            ...base,
            piles: { a: { draw: a, won: [] }, b: { draw: b, won: [] } },
        };
    }

    it("stamps the rules into the state", () => {
        const state = createGame(bataille, duo, {
            seed: 1,
            rules: { threeCardWar: true },
        });
        expect(state.rules).toEqual({ threeCardWar: true });
    });

    it("French rules stake one card, War stakes three", () => {
        const rng = createRng(1);
        const fr = bataille.withRules?.({ threeCardWar: false }) ?? bataille;
        const war = bataille.withRules?.({ threeCardWar: true }) ?? bataille;
        const flip = { type: "flip", playerId: "a" } as const;

        const frRes = fr.apply(tieState(false), flip, rng);
        const warRes = war.apply(tieState(true), flip, rng);
        if (!frRes.ok || !warRes.ok) throw new Error("refused");
        // FR: 10/10 tie, stake one (3 vs 4), flip 3 vs 4 → B wins 6 cards.
        expect(frRes.state.lastWinner).toBe("b");
        expect(frRes.state.piles.b.won).toHaveLength(6);
        // War: 10/10 tie, stake three, flip A vs 2 → A wins all 10 cards.
        expect(warRes.state.lastWinner).toBe("a");
        expect(warRes.state.piles.a.won).toHaveLength(10);
    });

    it("an unbound module deals legacy-shaped states (no rules field)", () => {
        const state = createGame(bataille, duo, { seed: 1 });
        expect("rules" in state).toBe(false);
    });
});

describe("Solitaire variants", () => {
    const solo: Player[] = [{ id: "solo", name: "Solo", seat: 0 }];
    const draw = { type: "draw", playerId: "solo" } as const;

    function start(rules: Record<string, boolean>): SolitaireState {
        return createGame(solitaire, solo, { seed: 7, rules });
    }

    function run(state: SolitaireState, n: number): SolitaireState {
        let s = state;
        for (let i = 0; i < n; i++) {
            const res = dispatch(solitaire, s, draw, "solo");
            if (!res.ok) throw new Error(res.error.code);
            s = res.state;
        }
        return s;
    }

    it("draw-three turns three cards, the stock's top ending on top", () => {
        const s0 = start({ drawThree: true, limitedPasses: false });
        const res = dispatch(solitaire, s0, draw, "solo");
        if (!res.ok) throw new Error(res.error.code);
        expect(res.state.waste).toEqual(s0.stock.slice(-3).reverse());
        expect(res.state.stock).toHaveLength(s0.stock.length - 3);
    });

    it("Vegas draw-one allows a single pass — no recycle", () => {
        const s0 = start({ drawThree: false, limitedPasses: true });
        const spent = run(s0, s0.stock.length);
        expect(spent.stock).toHaveLength(0);
        const res = dispatch(solitaire, spent, draw, "solo");
        expect(res.ok).toBe(false);
        expect(
            solitaire
                .legalActions(spent, "solo")
                .some((a) => a.type === "draw"),
        ).toBe(false);
    });

    it("Vegas draw-three allows three passes (two recycles)", () => {
        const s0 = start({ drawThree: true, limitedPasses: true });
        const perPass = Math.ceil(s0.stock.length / 3);
        let s = s0;
        for (let pass = 0; pass < 3; pass++) {
            s = run(s, perPass);
            expect(s.stock).toHaveLength(0);
            if (pass < 2) s = run(s, 1); // recycle
        }
        expect(s.redeals).toBe(2);
        expect(dispatch(solitaire, s, draw, "solo").ok).toBe(false);
    });

    it("classic rules keep unlimited redeals", () => {
        const s0 = start({ drawThree: false, limitedPasses: false });
        let s = s0;
        for (let pass = 0; pass < 5; pass++) s = run(s, s0.stock.length + 1);
        expect(s.redeals).toBe(5);
    });
});
