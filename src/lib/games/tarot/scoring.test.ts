import { describe, expect, it } from "vitest";
import { tarot78 } from "@/lib/card/decks";
import type { CardDescriptor, Rank, Suit, TrumpIndex } from "@/lib/card/types";
import { buildDeck } from "@/lib/engine/deck";
import {
    BID_MULTIPLIER,
    BID_RANK,
    type CompletedTrick,
    cardPointsDemi,
    isBout,
    pilePointsDemi,
    scoreDeal,
    type TarotRules,
    type TrickCard,
    thresholdForBouts,
} from "./scoring";

// ── card builders ─────────────────────────────────────────────────────────────
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

const trick = (
    winnerId: string,
    plays: ReadonlyArray<readonly [string, CardDescriptor]>,
): CompletedTrick => ({
    leaderId: plays[0][0],
    plays: plays.map(([playerId, card]): TrickCard => ({ playerId, card })),
    winnerId,
});

const NO_PRIMES: TarotRules = {
    gardeSansContre: true,
    petitAuBout: false,
    slam: false,
};

describe("card values", () => {
    it("scores each honour rank", () => {
        expect(cardPointsDemi(C("K"))).toBe(9); // Roi — 4.5
        expect(cardPointsDemi(C("Q"))).toBe(7); // Dame — 3.5
        expect(cardPointsDemi(C("C"))).toBe(5); // Cavalier — 2.5
        expect(cardPointsDemi(C("J"))).toBe(3); // Valet — 1.5
        expect(cardPointsDemi(C("10"))).toBe(1); // pip — 0.5
        expect(cardPointsDemi(C("A"))).toBe(1);
    });

    it("scores bouts and plain trumps", () => {
        expect(cardPointsDemi(T(1))).toBe(9); // Petit — 4.5
        expect(cardPointsDemi(T(21))).toBe(9); // 21 — 4.5
        expect(cardPointsDemi(FOOL)).toBe(9); // Excuse — 4.5
        expect(cardPointsDemi(T(10))).toBe(1); // plain trump — 0.5
    });

    it("identifies the three bouts", () => {
        expect(isBout(T(1))).toBe(true);
        expect(isBout(T(21))).toBe(true);
        expect(isBout(FOOL)).toBe(true);
        expect(isBout(T(2))).toBe(false);
        expect(isBout(C("K"))).toBe(false);
    });

    it("totals the deck at exactly 91 points (182 demis)", () => {
        expect(pilePointsDemi(buildDeck(tarot78))).toBe(182);
    });
});

describe("thresholds", () => {
    it("hardens as bouts are lost", () => {
        expect(thresholdForBouts(3)).toBe(36);
        expect(thresholdForBouts(2)).toBe(41);
        expect(thresholdForBouts(1)).toBe(51);
        expect(thresholdForBouts(0)).toBe(56);
    });
});

describe("bid tables", () => {
    it("ranks bids and maps multipliers", () => {
        expect(BID_RANK.petite).toBeLessThan(BID_RANK.garde);
        expect(BID_RANK.garde).toBeLessThan(BID_RANK["garde-sans"]);
        expect(BID_RANK["garde-sans"]).toBeLessThan(BID_RANK["garde-contre"]);
        expect(BID_MULTIPLIER.petite).toBe(1);
        expect(BID_MULTIPLIER.garde).toBe(2);
        expect(BID_MULTIPLIER["garde-sans"]).toBe(4);
        expect(BID_MULTIPLIER["garde-contre"]).toBe(6);
    });
});

describe("scoreDeal — failed contract", () => {
    // One trump trick a wins: 21, Petit, K♠, Q♠ → 2 bouts, 17 pts < 41.
    const result = scoreDeal({
        players: ["a", "b", "c", "d"],
        taker: "a",
        contract: "petite",
        tricks: [
            trick("a", [
                ["a", T(21)],
                ["b", T(1)],
                ["c", C("K")],
                ["d", C("Q")],
            ]),
        ],
        chien: [],
        ecart: [],
        rules: NO_PRIMES,
    });

    it("counts the taker's points and bouts", () => {
        expect(result.takerPoints).toBe(17); // 4.5 + 4.5 + 4.5 + 3.5
        expect(result.bouts).toBe(2);
        expect(result.threshold).toBe(41);
        expect(result.made).toBe(false);
    });

    it("settles a zero-sum loss across the defenders", () => {
        // gap 24 → (25 + 24) × 1 = 49, taker loses it to each of three.
        expect(result.perDefender).toBe(-49);
        expect(result.scores.a).toBe(-147);
        expect(result.scores.b).toBe(49);
        expect(result.scores.c).toBe(49);
        expect(result.scores.d).toBe(49);
    });
});

describe("scoreDeal — made Garde Sans with the chien bonus", () => {
    // Last trick a wins (21, Petit, Excuse captured, plain trump) = 14 pts, 3
    // bouts; the untouched chien (4 Kings + 2 Dames = 25) scores for the taker.
    const result = scoreDeal({
        players: ["a", "b", "c", "d"],
        taker: "a",
        contract: "garde-sans",
        tricks: [
            trick("a", [
                ["a", T(21)],
                ["b", T(1)],
                ["c", FOOL],
                ["d", T(5)],
            ]),
        ],
        chien: [
            C("K", "spades"),
            C("K", "hearts"),
            C("K", "diamonds"),
            C("K", "clubs"),
            C("Q", "spades"),
            C("Q", "hearts"),
        ],
        ecart: [],
        rules: NO_PRIMES,
    });

    it("adds the chien to the taker and clears the threshold", () => {
        expect(result.takerPoints).toBe(39); // 14 + 25
        expect(result.bouts).toBe(3);
        expect(result.threshold).toBe(36);
        expect(result.made).toBe(true);
    });

    it("applies the ×4 Garde Sans multiplier", () => {
        // gap 3 → (25 + 3) × 4 = 112 from each of three defenders.
        expect(result.multiplier).toBe(4);
        expect(result.perDefender).toBe(112);
        expect(result.scores.a).toBe(336);
        expect(result.scores.b).toBe(-112);
    });
});

describe("scoreDeal — the Excuse", () => {
    it("keeps the Excuse for its player and pays a half-point to the winner", () => {
        // a (taker) plays the Excuse on a trick the defence (b) wins.
        const result = scoreDeal({
            players: ["a", "b", "c", "d"],
            taker: "a",
            contract: "petite",
            tricks: [
                trick("b", [
                    ["a", FOOL],
                    ["b", T(2)],
                    ["c", C("3")],
                    ["d", C("4")],
                ]),
                // a needs to actually win a trick or the Excuse rule on the LAST
                // trick would capture it — give a a trailing win with no Excuse.
                trick("a", [
                    ["a", T(3)],
                    ["b", C("5")],
                    ["c", C("6")],
                    ["d", C("7")],
                ]),
            ],
            chien: [],
            ecart: [],
            rules: NO_PRIMES,
        });
        // Excuse (4.5) stays with a, who owes 0.5 to b. a also wins trick 2
        // (trump3 0.5 + three pips 1.5) = 2.0. Taker = 4.5 − 0.5 + 2.0 = 6.0.
        expect(result.takerPoints).toBe(6);
        expect(result.bouts).toBe(1); // the Excuse counts as the taker's bout
    });

    it("lets the winner capture the Excuse on the last trick", () => {
        const result = scoreDeal({
            players: ["a", "b", "c", "d"],
            taker: "a",
            contract: "petite",
            tricks: [
                // Only trick = last trick: b wins, captures the Excuse a played.
                trick("b", [
                    ["a", FOOL],
                    ["b", T(2)],
                    ["c", C("3")],
                    ["d", C("4")],
                ]),
            ],
            chien: [],
            ecart: [],
            rules: NO_PRIMES,
        });
        // a keeps nothing; the Excuse (and its bout) went to defender b.
        expect(result.takerPoints).toBe(0);
        expect(result.bouts).toBe(0);
    });
});

describe("scoreDeal — primes", () => {
    it("awards Petit au bout to the last-trick winner (×mult)", () => {
        const tricks: CompletedTrick[] = [
            trick("b", [
                ["a", C("2")],
                ["b", C("K")],
                ["c", C("3")],
                ["d", C("4")],
            ]),
            // Last trick carries the Petit and a wins it → +10 × garde(2).
            trick("a", [
                ["a", T(1)],
                ["b", T(2)],
                ["c", C("5")],
                ["d", C("6")],
            ]),
        ];
        const withPrime = scoreDeal({
            players: ["a", "b", "c", "d"],
            taker: "a",
            contract: "garde",
            tricks,
            chien: [],
            ecart: [],
            rules: { gardeSansContre: true, petitAuBout: true, slam: false },
        });
        const without = scoreDeal({
            players: ["a", "b", "c", "d"],
            taker: "a",
            contract: "garde",
            tricks,
            chien: [],
            ecart: [],
            rules: NO_PRIMES,
        });
        expect(withPrime.petitAuBout).toBe(1);
        expect(withPrime.perDefender - without.perDefender).toBe(20); // 10 × 2
    });

    it("awards a +200 slam when the taker sweeps every trick", () => {
        const tricks: CompletedTrick[] = [
            trick("a", [
                ["a", T(5)],
                ["b", T(2)],
                ["c", C("3")],
                ["d", C("4")],
            ]),
        ];
        const base = {
            players: ["a", "b", "c", "d"],
            taker: "a",
            contract: "petite" as const,
            tricks,
            chien: [],
            ecart: [],
        };
        const withSlam = scoreDeal({
            ...base,
            rules: { gardeSansContre: true, petitAuBout: false, slam: true },
        });
        const without = scoreDeal({ ...base, rules: NO_PRIMES });
        expect(withSlam.chelem).toBe(200);
        // The slam prime lands whole on top of the contract value.
        expect(withSlam.perDefender - without.perDefender).toBe(200);
    });
});

describe("scoreDeal — conservation", () => {
    // Partition the whole 78-card deck into tricks + a 6-card remainder and
    // assert the two sides' points always sum to 91, for every contract.
    const deck = buildDeck(tarot78);
    const players = ["a", "b", "c", "d"];

    function buildTricks(
        remainder: readonly CardDescriptor[],
    ): CompletedTrick[] {
        const played = deck.filter(
            (c) =>
                !remainder.some((r) => JSON.stringify(r) === JSON.stringify(c)),
        );
        const tricks: CompletedTrick[] = [];
        for (let i = 0; i + 4 <= played.length; i += 4) {
            const slice = played.slice(i, i + 4);
            // Alternate winners so neither side sweeps (avoids slam noise).
            const winnerId = players[(i / 4) % players.length];
            tricks.push(
                trick(
                    winnerId,
                    slice.map((card, j): readonly [string, CardDescriptor] => [
                        players[j],
                        card,
                    ]),
                ),
            );
        }
        return tricks;
    }

    const remainder = deck.slice(72); // last 6 cards = chien / écart

    it.each(["petite", "garde", "garde-sans", "garde-contre"] as const)(
        "keeps taker + defence = 91 for %s",
        (contract) => {
            const onPetite = contract === "petite" || contract === "garde";
            const result = scoreDeal({
                players,
                taker: "a",
                contract,
                tricks: buildTricks(remainder),
                chien: onPetite ? [] : remainder,
                ecart: onPetite ? remainder : [],
                rules: NO_PRIMES,
            });
            expect(result.takerPoints + result.defencePoints).toBe(91);
        },
    );

    it("nets every score to zero", () => {
        const result = scoreDeal({
            players,
            taker: "a",
            contract: "garde",
            tricks: buildTricks(remainder),
            chien: [],
            ecart: remainder,
            rules: NO_PRIMES,
        });
        const total = Object.values(result.scores).reduce((s, v) => s + v, 0);
        expect(total).toBe(0);
    });
});
