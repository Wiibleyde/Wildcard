import type { CardDescriptor } from "@/lib/card/types";

/**
 * French Tarot scoring — the "comptage à seuil" the game is famous for.
 *
 * This module is deliberately split from the reducer (`tarot.ts`): a finished
 * deal's score is a **pure function of its tricks** (plus the écart/chien and
 * the contract). Isolating it keeps the most rule-dense, jury-defensible part
 * of the game independently unit-testable, and mirrors the engine's wider
 * determinism ethos (a game = pure function of seed + action log).
 *
 * Everything is computed in **demi-points** (card values doubled to integers)
 * to dodge floating-point error: a King is worth 4.5 points, i.e. 9 demis. The
 * 78-card deck totals exactly 91 points = 182 demis, an invariant every score
 * preserves (see {@link scoreDeal} and its tests).
 */

/** The four contracts a taker can win the bidding with, weakest → strongest. */
export type Bid = "petite" | "garde" | "garde-sans" | "garde-contre";

/** Bidding strength — only a strictly higher bid may overcall (one round). */
export const BID_RANK: Record<Bid, number> = {
    petite: 1,
    garde: 2,
    "garde-sans": 3,
    "garde-contre": 4,
};

/**
 * Contract multiplier applied to the whole result. Note it is NOT the bidding
 * rank: Garde Sans / Garde Contre jump to ×4 / ×6 because the taker forgoes (or
 * gambles against) the chien.
 */
export const BID_MULTIPLIER: Record<Bid, number> = {
    petite: 1,
    garde: 2,
    "garde-sans": 4,
    "garde-contre": 6,
};

/** Rules that change scoring (declared in the lobby, stamped into the state). */
export interface TarotRules {
    /** Allow the higher Garde Sans / Garde Contre overcalls in the bidding. */
    readonly gardeSansContre: boolean;
    /** « Petit au bout » — +10 (×mult) to whoever wins the last trick if the
     * Petit (trump 1) is played in it. */
    readonly petitAuBout: boolean;
    /** « Chelem » — auto-detected slam: ±200 flat when one side wins every
     * trick (unannounced variant). */
    readonly slam: boolean;
}

export const DEFAULT_TAROT_RULES: TarotRules = {
    gardeSansContre: true,
    petitAuBout: true,
    slam: true,
};

/** One card laid by one player. */
export interface TrickCard {
    readonly playerId: string;
    readonly card: CardDescriptor;
}

/** A finished trick: the cards in play order plus the resolved winner. */
export interface CompletedTrick {
    readonly leaderId: string;
    readonly plays: readonly TrickCard[];
    /** Highest trump, else highest card of the led suit — never the Excuse. */
    readonly winnerId: string;
}

/** The three *bouts* (oudlers): trump 1 (Petit), trump 21, and the Excuse.
 * They alone set the points threshold the taker must reach — and are the most
 * valuable cards in the deck. */
export function isBout(card: CardDescriptor): boolean {
    if (card.type === "fool") return true;
    return card.type === "trump" && (card.index === 1 || card.index === 21);
}

/**
 * Card value in **demi-points** (real value ×2, so every value is an integer):
 * - Bout or King — 9 (4.5 pts)
 * - Queen (Dame) — 7 (3.5)
 * - Cavalier — 5 (2.5)
 * - Valet (Jack) — 3 (1.5)
 * - everything else (pips, plain trumps) — 1 (0.5)
 */
export function cardPointsDemi(card: CardDescriptor): number {
    if (card.type === "fool") return 9; // the Excuse is a bout — worth 4.5
    if (card.type === "trump") {
        return card.index === 1 || card.index === 21 ? 9 : 1;
    }
    if (card.type === "suited") {
        switch (card.rank) {
            case "K":
                return 9; // Roi
            case "Q":
                return 7; // Dame
            case "C":
                return 5; // Cavalier
            case "J":
                return 3; // Valet
            default:
                return 1; // pips A(1)–10
        }
    }
    return 1; // jokers never appear in a tarot deck — defensive default
}

/** Sum a pile's card values, in demi-points. */
export function pilePointsDemi(cards: readonly CardDescriptor[]): number {
    return cards.reduce((sum, c) => sum + cardPointsDemi(c), 0);
}

/**
 * Points the taker must reach, by the number of bouts in their final pile.
 * Fewer bouts ⇒ harder contract. This is the eponymous "seuil".
 */
export function thresholdForBouts(bouts: number): number {
    switch (bouts) {
        case 3:
            return 36;
        case 2:
            return 41;
        case 1:
            return 51;
        default:
            return 56; // 0 bouts
    }
}

/** Inputs to {@link scoreDeal} — everything a finished deal is scored from. */
export interface DealInput {
    /** All player ids (any order). */
    readonly players: readonly string[];
    readonly taker: string;
    readonly contract: Bid;
    /** Completed tricks, in play order; the last one drives « petit au bout ». */
    readonly tricks: readonly CompletedTrick[];
    /** The six dog cards. Counted for the taker on Garde Sans, for the defence
     * on Garde Contre, and ignored here on Petite/Garde (those cards live in the
     * taker's hand → tricks, or in the écart below). */
    readonly chien: readonly CardDescriptor[];
    /** The six cards the taker set aside (Petite/Garde) — counted for the taker.
     * Empty for Garde Sans / Garde Contre. */
    readonly ecart: readonly CardDescriptor[];
    readonly rules: TarotRules;
}

/** Full, explainable breakdown of a scored deal (taker's perspective). */
export interface DealResult {
    /** Taker card points (real points, may be a half). */
    readonly takerPoints: number;
    /** Defence card points — `takerPoints + defencePoints === 91`. */
    readonly defencePoints: number;
    readonly bouts: number;
    readonly threshold: number;
    /** `takerPoints − threshold`; ≥ 0 ⇒ contract made. */
    readonly diff: number;
    readonly made: boolean;
    readonly multiplier: number;
    /** Last-trick Petit bonus, taker's sign: +1 won it, −1 defence won it, 0 none. */
    readonly petitAuBout: -1 | 0 | 1;
    /** Slam bonus, taker's perspective: +200, −200, or 0. */
    readonly chelem: number;
    /** What the taker gains from EACH defender (negative = the taker pays). */
    readonly perDefender: number;
    /** Final signed score per player. Zero-sum across the table. */
    readonly scores: Record<string, number>;
}

/**
 * Score a finished deal. Pure — no randomness, no state mutation.
 *
 * The hard part is the Excuse (« L'Excuse »): it never wins a trick. Normally
 * the player who plays it keeps it in their own pile and hands a low (0.5) card
 * to the trick's winner; on the very last trick it is instead captured by the
 * winner — unless its owner's side has swept every trick (grand chelem). We
 * resolve all of that by assigning each card to the taker or defence pile, then
 * applying the half-point Excuse transfers as a demi-point adjustment, so the
 * 182-demi (91-point) total is always conserved.
 */
export function scoreDeal(input: DealInput): DealResult {
    const { players, taker, contract, tricks, chien, ecart, rules } = input;

    const takerCards: CardDescriptor[] = [];
    const defenceCards: CardDescriptor[] = [];
    // Net demi-points moved by Excuse exchanges: + toward the taker, − toward
    // the defence. Keeps the 0.5 card transfer exact without tracking identities.
    let excuseTransferDemi = 0;

    const takerWonAll = tricks.every((t) => t.winnerId === taker);
    const defenceWonAll = tricks.every((t) => t.winnerId !== taker);

    tricks.forEach((trick, index) => {
        const winnerIsTaker = trick.winnerId === taker;
        const sink = winnerIsTaker ? takerCards : defenceCards;
        const excuse = trick.plays.find((p) => p.card.type === "fool");

        for (const play of trick.plays) {
            if (play.card.type === "fool") continue; // resolved below
            sink.push(play.card);
        }

        if (!excuse) return;

        const excuseIsTaker = excuse.playerId === taker;
        const excuseSideWonAll = excuseIsTaker ? takerWonAll : defenceWonAll;
        const isLastTrick = index === tricks.length - 1;

        // Last trick: the Excuse is captured by the trick winner — unless its
        // owner's side made a grand chelem, in which case they keep it.
        if (isLastTrick && !excuseSideWonAll) {
            sink.push(excuse.card);
            return;
        }

        // Otherwise the Excuse goes back to its owner's pile…
        (excuseIsTaker ? takerCards : defenceCards).push(excuse.card);
        // …and its owner owes the trick winner one low card (0.5 = 1 demi).
        if (winnerIsTaker !== excuseIsTaker) {
            excuseTransferDemi += winnerIsTaker ? 1 : -1;
        }
    });

    // Écart always counts for the taker (empty on Sans/Contre). The chien is
    // a block bonus for one side on Sans/Contre, and already accounted on Petite
    // /Garde (its cards passed through the taker's hand).
    for (const c of ecart) takerCards.push(c);
    if (contract === "garde-sans") for (const c of chien) takerCards.push(c);
    if (contract === "garde-contre")
        for (const c of chien) defenceCards.push(c);

    const takerDemi = pilePointsDemi(takerCards) + excuseTransferDemi;
    const defenceDemi = pilePointsDemi(defenceCards) - excuseTransferDemi;
    const bouts = takerCards.filter(isBout).length;

    const threshold = thresholdForBouts(bouts);
    const thresholdDemi = threshold * 2;
    const made = takerDemi >= thresholdDemi;
    const gapDemi = Math.abs(takerDemi - thresholdDemi);
    // The half-point goes to the taker (« le demi-point bénéficie au preneur »):
    // round the gap up when they win (bigger reward), down when they lose
    // (smaller penalty). Both nudge the result in the taker's favour.
    const gap = made ? Math.ceil(gapDemi / 2) : Math.floor(gapDemi / 2);

    const multiplier = BID_MULTIPLIER[contract];

    // « Petit au bout » — Petit (trump 1) played in the last trick: +10 (×mult)
    // to whichever side won that trick.
    let petitAuBout: -1 | 0 | 1 = 0;
    const last = tricks[tricks.length - 1];
    if (
        rules.petitAuBout &&
        last?.plays.some((p) => p.card.type === "trump" && p.card.index === 1)
    ) {
        petitAuBout = last.winnerId === taker ? 1 : -1;
    }

    // « Chelem » — unannounced slam: one side wins all the tricks.
    let chelem = 0;
    if (rules.slam) {
        if (takerWonAll) chelem = 200;
        else if (defenceWonAll) chelem = -200;
    }

    // Result per defender (taker's perspective): the signed contract value,
    // plus the (independently signed) Petit prime, plus the flat slam prime.
    const contractValue = (25 + gap) * multiplier;
    const perDefender =
        (made ? contractValue : -contractValue) +
        petitAuBout * 10 * multiplier +
        chelem;

    const defenders = players.filter((p) => p !== taker);
    const scores: Record<string, number> = {
        [taker]: perDefender * defenders.length,
    };
    for (const d of defenders) scores[d] = -perDefender;

    return {
        takerPoints: takerDemi / 2,
        defencePoints: defenceDemi / 2,
        bouts,
        threshold,
        diff: (takerDemi - thresholdDemi) / 2,
        made,
        multiplier,
        petitAuBout,
        chelem,
        perDefender,
        scores,
    };
}
