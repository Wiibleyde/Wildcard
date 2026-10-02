import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit, TrumpIndex } from "@/lib/card/types";
import { createGame, dispatch } from "@/lib/engine/runner";
import { type Player, resolveRuleToggles } from "@/lib/engine/types";
import {
    type CompletedTrick,
    type DealInput,
    scoreDeal,
    type TarotRules,
    type TrickCard,
} from "./scoring";
import {
    bestHandful,
    handfulAt,
    TAROT_RULE_TOGGLES,
    type TarotAction,
    type TarotState,
    tarot,
} from "./tarot";

/**
 * FFT « Règlement officiel » — poignées and announced chelem
 * (https://www.fftarot.fr). Thresholds 10/13/15 trumps at four players,
 * 13/15/18 at three; primes 20/30/40 never multiplied and credited to the side
 * that wins the deal; slam +400 announced / +200 unannounced / −200 missed.
 */

const T = (index: number): CardDescriptor => ({
    type: "trump",
    index: index as TrumpIndex,
});
const FOOL: CardDescriptor = { type: "fool" };
const C = (rank: Rank, suit: Suit = "spades"): CardDescriptor => ({
    type: "suited",
    suit,
    rank,
});
const trumps = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => T(from + i));

const P4: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
    { id: "c", name: "C", seat: 2 },
    { id: "d", name: "D", seat: 3 },
];

const FFT: TarotRules = {
    gardeSansContre: true,
    petitAuBout: false,
    slam: true,
    announcedSlam: true,
    handful: true,
};

const play = (playerId: string, card: CardDescriptor): TrickCard => ({
    playerId,
    card,
});

/** One trick the taker wins with three bouts in reach — a made Garde by 6:
 * (25 + 6) × 2 = 62 per defender. */
const WON_TRICK: CompletedTrick = {
    leaderId: "a",
    plays: [
        play("a", T(21)),
        play("b", T(1)),
        play("c", C("K", "hearts")),
        play("d", C("K", "diamonds")),
    ],
    winnerId: "a",
};
const MADE: DealInput = {
    players: ["a", "b", "c", "d"],
    taker: "a",
    contract: "garde",
    tricks: [WON_TRICK],
    chien: [],
    ecart: [
        FOOL,
        C("K"),
        C("K", "clubs"),
        C("Q"),
        C("Q", "hearts"),
        C("Q", "diamonds"),
    ],
    rules: FFT,
};
/** The same deal with a defender winning the trick — Petite failed by 23. */
const FAILED: DealInput = {
    ...MADE,
    contract: "petite",
    ecart: [],
    tricks: [{ ...WON_TRICK, winnerId: "b" }],
};

describe("FFT scoring — poignée", () => {
    it("credits a defender's handful to the taker when the contract is made", () => {
        const r = scoreDeal({
            ...MADE,
            handfuls: { b: { level: "simple", cards: [] } },
        });
        expect(r.made).toBe(true);
        expect(r.handful).toBe(20);
        // Never multiplied: 62 (contract) + 20 (handful) + 200 (unannounced slam).
        expect(r.perDefender).toBe(62 + 20 + 200);
    });

    it("charges the taker's own handful when the contract fails", () => {
        const r = scoreDeal({
            ...FAILED,
            handfuls: { a: { level: "double", cards: [] } },
        });
        expect(r.made).toBe(false);
        expect(r.handful).toBe(-30);
    });

    it("sums every shown handful", () => {
        const r = scoreDeal({
            ...MADE,
            handfuls: {
                a: { level: "triple", cards: [] },
                c: { level: "simple", cards: [] },
            },
        });
        expect(r.handful).toBe(60);
    });

    it("ignores handfuls when the rule is off", () => {
        const r = scoreDeal({
            ...MADE,
            rules: { ...FFT, handful: false },
            handfuls: { a: { level: "triple", cards: [] } },
        });
        expect(r.handful).toBe(0);
    });

    it("keeps a legacy result's exact shape (no handful field)", () => {
        const r = scoreDeal({
            ...MADE,
            rules: { gardeSansContre: true, petitAuBout: true, slam: true },
        });
        expect("handful" in r).toBe(false);
    });
});

describe("FFT scoring — chelem", () => {
    it("announced and made: +400", () => {
        expect(scoreDeal({ ...MADE, slamAnnounced: true }).chelem).toBe(400);
    });

    it("unannounced but made: +200", () => {
        expect(scoreDeal(MADE).chelem).toBe(200);
    });

    it("announced and missed: −200", () => {
        const missed: DealInput = {
            ...MADE,
            slamAnnounced: true,
            tricks: [WON_TRICK, { ...WON_TRICK, winnerId: "c" }],
        };
        expect(scoreDeal(missed).chelem).toBe(-200);
    });

    it("a slam inflicted by the defence earns it 200", () => {
        expect(scoreDeal(FAILED).chelem).toBe(-200);
    });
});

describe("handful selection", () => {
    it("shows the strongest trumps for the level held (4 players)", () => {
        const hand = [...trumps(1, 12), C("K")];
        expect(bestHandful(hand, 4)?.level).toBe("simple");
        // Hides the low ones — the Petit first.
        expect(handfulAt(hand, "simple", 4)).toEqual(trumps(3, 12).reverse());
    });

    it("climbs to double and triple", () => {
        expect(bestHandful(trumps(1, 13), 4)?.level).toBe("double");
        expect(bestHandful(trumps(1, 15), 4)?.level).toBe("triple");
    });

    it("lets the Excuse stand in only for the last missing trump", () => {
        const nine = trumps(1, 9);
        const withExcuse = handfulAt([...nine, FOOL], "simple", 4);
        expect(withExcuse).toHaveLength(10);
        expect(withExcuse).toContainEqual(FOOL);
        expect(handfulAt([...trumps(1, 8), FOOL], "simple", 4)).toBeNull();
        // With ten real trumps the Excuse is never shown.
        expect(
            handfulAt([...trumps(1, 10), FOOL], "simple", 4),
        ).not.toContainEqual(FOOL);
    });

    it("uses the three-player thresholds (13 / 15 / 18)", () => {
        expect(bestHandful(trumps(1, 12), 3)).toBeNull();
        expect(bestHandful(trumps(1, 13), 3)?.level).toBe("simple");
        expect(bestHandful(trumps(1, 18), 3)?.level).toBe("triple");
    });
});

// ── reducer ───────────────────────────────────────────────────────────────────

function ok(s: TarotState, action: TarotAction): TarotState {
    const res = dispatch(tarot, s, action, action.playerId);
    if (!res.ok) throw new Error(`unexpected refusal: ${res.error.code}`);
    return res.state;
}

/** B takes a Garde Contre (no dog) — the game sits in the slam phase. */
function intoSlam(): TarotState {
    let s = createGame(tarot, P4, 1, "g");
    s = ok(s, { type: "pass", playerId: "a" });
    s = ok(s, { type: "bid", playerId: "b", bid: "garde-contre" });
    s = ok(s, { type: "pass", playerId: "c" });
    return ok(s, { type: "pass", playerId: "d" });
}

describe("announced slam (reducer)", () => {
    it("asks the taker before the first card", () => {
        const s = intoSlam();
        expect(s.phase).toBe("slam");
        expect(s.currentPlayerId).toBe("b");
        expect(tarot.legalActions(s, "b").map((a) => a.type)).toEqual([
            "announceSlam",
            "pass",
        ]);
        expect(tarot.legalActions(s, "a")).toEqual([]);
    });

    it("hands the lead to the announcer", () => {
        const s = ok(intoSlam(), { type: "announceSlam", playerId: "b" });
        expect(s.phase).toBe("playing");
        expect(s.slamAnnounced).toBe(true);
        expect(s.currentPlayerId).toBe("b");
        expect(s.trickLeaderId).toBe("b");
        expect(tarot.view(s, null).slamAnnounced).toBe(true);
    });

    it("a pass leaves the lead to the eldest hand", () => {
        const s = ok(intoSlam(), { type: "pass", playerId: "b" });
        expect(s.currentPlayerId).toBe("a");
        expect(s.slamAnnounced).toBeUndefined();
    });

    it("is flagged risky so bots never gamble on it", () => {
        expect(tarot.riskyActions).toContain("announceSlam");
    });

    it("needs the slam rule", () => {
        const rules = resolveRuleToggles(TAROT_RULE_TOGGLES, { slam: false });
        expect(rules.announcedSlam).toBe(false);
    });
});

describe("poignée (reducer)", () => {
    /** Playing, A (eldest) to lead, holding exactly ten trumps + the Excuse. */
    function withTenTrumps(): TarotState {
        const s = ok(intoSlam(), { type: "pass", playerId: "b" });
        const filler = (["2", "3", "4", "5", "6", "7", "8"] as const).map(
            (rank) => C(rank, "hearts"),
        );
        const hand = [...trumps(1, 10), FOOL, ...filler];
        return { ...s, hands: { ...s.hands, a: hand } };
    }

    it("is offered before the player's first card, then shown publicly", () => {
        const s0 = withTenTrumps();
        const offer = tarot
            .legalActions(s0, "a")
            .find((a) => a.type === "handful");
        expect(offer).toEqual({
            type: "handful",
            playerId: "a",
            level: "simple",
        });

        const s = ok(s0, { type: "handful", playerId: "a", level: "simple" });
        expect(s.currentPlayerId).toBe("a"); // still to lead
        const shown = tarot
            .view(s, "c")
            .players.find((p) => p.playerId === "a");
        expect(shown?.handful?.level).toBe("simple");
        expect(shown?.handful?.cards).toEqual(trumps(1, 10).reverse());
        // Once only.
        expect(
            tarot.legalActions(s, "a").some((a) => a.type === "handful"),
        ).toBe(false);
        const again = dispatch(
            tarot,
            s,
            { type: "handful", playerId: "a", level: "simple" },
            "a",
        );
        expect(again.ok).toBe(false);
    });

    it("refuses a level the hand can't reach", () => {
        const res = dispatch(
            tarot,
            withTenTrumps(),
            { type: "handful", playerId: "a", level: "double" },
            "a",
        );
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("illegal_handful");
    });

    it("validates explicitly named cards", () => {
        const s0 = withTenTrumps();
        const named = ok(s0, {
            type: "handful",
            playerId: "a",
            level: "simple",
            cards: trumps(1, 10),
        });
        expect(named.handfuls?.a?.cards).toHaveLength(10);

        // The Excuse while a real trump stays hidden — illegal (FFT).
        const cheat = dispatch(
            tarot,
            s0,
            {
                type: "handful",
                playerId: "a",
                level: "simple",
                cards: [...trumps(1, 9), FOOL],
            },
            "a",
        );
        expect(cheat.ok).toBe(false);
        // A card not held — illegal.
        const forged = dispatch(
            tarot,
            s0,
            {
                type: "handful",
                playerId: "a",
                level: "simple",
                cards: [...trumps(1, 9), T(21)],
            },
            "a",
        );
        expect(forged.ok).toBe(false);
    });

    it("is no longer offered once the player has laid a card", () => {
        let s = withTenTrumps();
        const lead = tarot.legalActions(s, "a").find((a) => a.type === "play");
        if (!lead) throw new Error("no lead");
        s = ok(s, lead);
        // Back to A at the next trick: too late.
        expect(s.hands.a.length).toBe(17);
        expect(
            dispatch(
                tarot,
                { ...s, currentPlayerId: "a" },
                { type: "handful", playerId: "a", level: "simple" },
                "a",
            ).ok,
        ).toBe(false);
    });
});

describe("legacy deals (rules predating poignée / chelem annoncé)", () => {
    const legacy = tarot.withRules?.({
        gardeSansContre: true,
        petitAuBout: true,
        slam: true,
    });

    it("skip the slam phase and never offer a handful", () => {
        if (!legacy) throw new Error("withRules missing");
        let s = createGame(legacy, P4, 1, "g");
        expect(s.rules).toEqual({
            gardeSansContre: true,
            petitAuBout: true,
            slam: true,
        });
        s = ok(s, { type: "bid", playerId: "a", bid: "garde-contre" });
        for (const id of ["b", "c", "d"]) {
            s = ok(s, { type: "pass", playerId: id });
        }
        expect(s.phase).toBe("playing");
        expect(
            legacy.legalActions(s, "a").some((a) => a.type === "handful"),
        ).toBe(false);
    });
});
