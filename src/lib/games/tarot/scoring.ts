import type { CardDescriptor } from "@/lib/card/types";

/*
 * French Tarot scoring (« comptage à seuil »), split from the reducer: a deal's
 * score is a pure function of its tricks, chien/écart and contract. Computed
 * in demi-points (values ×2) to stay in integers; the 78-card deck always
 * totals 182 demis (91 points).
 */

export type Bid = "petite" | "garde" | "garde-sans" | "garde-contre";

/** Bidding strength — only a strictly higher bid overcalls. */
export const BID_RANK: Record<Bid, number> = {
    petite: 1,
    garde: 2,
    "garde-sans": 3,
    "garde-contre": 4,
};

/** NOT the bidding rank: Sans/Contre jump to ×4/×6 (the taker forgoes the chien). */
export const BID_MULTIPLIER: Record<Bid, number> = {
    petite: 1,
    garde: 2,
    "garde-sans": 4,
    "garde-contre": 6,
};

const PETIT = 1;
const TWENTY_ONE = 21;

/** Base value of a contract, before the point gap and the multiplier. */
const CONTRACT_BASE = 25;
/** « Petit au bout », multiplied by the contract. */
const PETIT_AU_BOUT_BONUS = 10;
const ANNOUNCED_SLAM_MADE = 400;
const SLAM_BONUS = 200;

export interface TarotRules {
    readonly gardeSansContre: boolean;
    /** +10 (×mult) to whoever wins the last trick when the Petit is in it. */
    readonly petitAuBout: boolean;
    /** Unannounced slam: ±200 when one side wins every trick. */
    readonly slam: boolean;
    /** Taker may announce before the first card: +400 made, −200 missed. Absent = off (legacy deals). */
    readonly announcedSlam?: boolean;
    /** « Poignée »: flat primes to the side winning the deal. Absent = off (legacy deals). */
    readonly handful?: boolean;
}

export const DEFAULT_TAROT_RULES: TarotRules = {
    gardeSansContre: true,
    petitAuBout: true,
    slam: true,
    announcedSlam: true,
    handful: true,
};

export type HandfulLevel = "simple" | "double" | "triple";

export const HANDFUL_LEVELS: readonly HandfulLevel[] = [
    "simple",
    "double",
    "triple",
];

/** Never multiplied by the contract (FFT). */
const HANDFUL_PRIME: Record<HandfulLevel, number> = {
    simple: 20,
    double: 30,
    triple: 40,
};

/** FFT: 10/13/15 trumps at four players, 13/15/18 at three. */
export function handfulSize(level: HandfulLevel, playerCount: number): number {
    const sizes: Record<HandfulLevel, number> =
        playerCount === 3
            ? { simple: 13, double: 15, triple: 18 }
            : { simple: 10, double: 13, triple: 15 };
    return sizes[level];
}

export interface DeclaredHandful {
    readonly level: HandfulLevel;
    /** Strongest first. */
    readonly cards: readonly CardDescriptor[];
}

export interface TrickCard {
    readonly playerId: string;
    readonly card: CardDescriptor;
}

export interface CompletedTrick {
    readonly leaderId: string;
    readonly plays: readonly TrickCard[];
    readonly winnerId: string;
}

function isPetit(card: CardDescriptor): boolean {
    return card.type === "trump" && card.index === PETIT;
}

/** The three bouts — Petit, 21 and the Excuse — set the taker's threshold. */
export function isBout(card: CardDescriptor): boolean {
    if (card.type === "fool") return true;
    return (
        card.type === "trump" &&
        (card.index === PETIT || card.index === TWENTY_ONE)
    );
}

/** Demi-points: bout/King 9, Queen 7, Cavalier 5, Jack 3, anything else 1. */
export function cardPointsDemi(card: CardDescriptor): number {
    if (isBout(card)) return 9;
    if (card.type !== "suited") return 1;
    switch (card.rank) {
        case "K":
            return 9;
        case "Q":
            return 7;
        case "C":
            return 5;
        case "J":
            return 3;
        default:
            return 1;
    }
}

export function pilePointsDemi(cards: readonly CardDescriptor[]): number {
    return cards.reduce((sum, c) => sum + cardPointsDemi(c), 0);
}

/** Points the taker needs, by bouts won — the eponymous « seuil ». */
export function thresholdForBouts(bouts: number): number {
    switch (bouts) {
        case 3:
            return 36;
        case 2:
            return 41;
        case 1:
            return 51;
        default:
            return 56;
    }
}

export interface DealInput {
    readonly players: readonly string[];
    readonly taker: string;
    readonly contract: Bid;
    readonly tricks: readonly CompletedTrick[];
    /** Counted for the taker on Garde Sans, the defence on Garde Contre; else already in play. */
    readonly chien: readonly CardDescriptor[];
    /** Counted for the taker (empty on Sans/Contre). */
    readonly ecart: readonly CardDescriptor[];
    readonly rules: TarotRules;
    readonly handfuls?: Readonly<Record<string, DeclaredHandful>>;
    readonly slamAnnounced?: boolean;
}

/** Taker's perspective. */
export interface DealResult {
    readonly takerPoints: number;
    /** `takerPoints + defencePoints === 91`. */
    readonly defencePoints: number;
    readonly bouts: number;
    readonly threshold: number;
    /** ≥ 0 ⇒ made. */
    readonly diff: number;
    readonly made: boolean;
    readonly multiplier: number;
    /** +1 taker won it, −1 defence won it, 0 none. */
    readonly petitAuBout: -1 | 0 | 1;
    readonly chelem: number;
    /** Absent on legacy deals (rules predating the handful) — keeps their stored shape. */
    readonly handful?: number;
    /** What the taker gains from EACH defender (negative = pays). */
    readonly perDefender: number;
    /** Zero-sum across the table. */
    readonly scores: Record<string, number>;
}

/**
 * The Excuse never wins a trick: its owner keeps it and hands the winner a
 * low card (half a point) — except on the last trick, where the winner
 * captures it unless its owner's side swept every trick (grand chelem).
 * Cards go to the taker or defence pile; Excuse exchanges are a demi-point
 * adjustment, so the 182-demi total is always conserved.
 */
export function scoreDeal(input: DealInput): DealResult {
    const { players, taker, contract, tricks, chien, ecart, rules } = input;

    const takerCards: CardDescriptor[] = [];
    const defenceCards: CardDescriptor[] = [];
    // + toward the taker, − toward the defence.
    let excuseTransferDemi = 0;

    const takerWonAll = tricks.every((t) => t.winnerId === taker);
    const defenceWonAll = tricks.every((t) => t.winnerId !== taker);

    tricks.forEach((trick, index) => {
        const winnerIsTaker = trick.winnerId === taker;
        const sink = winnerIsTaker ? takerCards : defenceCards;
        const excuse = trick.plays.find((p) => p.card.type === "fool");

        for (const play of trick.plays) {
            if (play.card.type !== "fool") sink.push(play.card);
        }

        if (!excuse) return;

        const excuseIsTaker = excuse.playerId === taker;
        const excuseSideWonAll = excuseIsTaker ? takerWonAll : defenceWonAll;
        const isLastTrick = index === tricks.length - 1;

        if (isLastTrick && !excuseSideWonAll) {
            sink.push(excuse.card);
            return;
        }

        (excuseIsTaker ? takerCards : defenceCards).push(excuse.card);
        if (winnerIsTaker !== excuseIsTaker) {
            excuseTransferDemi += winnerIsTaker ? 1 : -1;
        }
    });

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
    // « Le demi-point bénéficie au preneur »: round up when made, down when not.
    const gap = made ? Math.ceil(gapDemi / 2) : Math.floor(gapDemi / 2);

    const multiplier = BID_MULTIPLIER[contract];

    // A slam side spending the last trick on the Excuse moves « the end » one
    // trick earlier (FFT): the Petit then counts in the penultimate trick.
    let petitAuBout: -1 | 0 | 1 = 0;
    const last = tricks[tricks.length - 1];
    const excuseClosesSlam =
        last !== undefined &&
        last.plays[0]?.card.type === "fool" &&
        last.winnerId === last.plays[0].playerId;
    const bout = excuseClosesSlam ? tricks[tricks.length - 2] : last;
    if (rules.petitAuBout && bout?.plays.some((p) => isPetit(p.card))) {
        petitAuBout = bout.winnerId === taker ? 1 : -1;
    }

    // A defence slam earns it the slam bonus either way — on top of a missed
    // announcement's penalty.
    let chelem = 0;
    if (rules.announcedSlam && input.slamAnnounced) {
        chelem = takerWonAll ? ANNOUNCED_SLAM_MADE : -SLAM_BONUS;
        if (defenceWonAll) chelem -= SLAM_BONUS;
    } else if (rules.slam) {
        if (takerWonAll) chelem = SLAM_BONUS;
        else if (defenceWonAll) chelem = -SLAM_BONUS;
    }

    const handfulTotal = rules.handful
        ? Object.values(input.handfuls ?? {}).reduce(
              (sum, h) => sum + HANDFUL_PRIME[h.level],
              0,
          )
        : 0;
    const handful = made ? handfulTotal : -handfulTotal;

    const contractValue = (CONTRACT_BASE + gap) * multiplier;
    const perDefender =
        (made ? contractValue : -contractValue) +
        petitAuBout * PETIT_AU_BOUT_BONUS * multiplier +
        handful +
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
        ...(rules.handful === undefined ? {} : { handful }),
        perDefender,
        scores,
    };
}
