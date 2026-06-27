import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank, Suit, TrumpIndex } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { createGame, dispatch, replay } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import type { TrickCard } from "./scoring";
import {
    discardableCards,
    legalCards,
    type TarotAction,
    type TarotState,
    tarot,
    trickWinner,
} from "./tarot";

const P4: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
    { id: "c", name: "C", seat: 2 },
    { id: "d", name: "D", seat: 3 },
];
const P3: Player[] = P4.slice(0, 3);

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
const tc = (playerId: string, card: CardDescriptor): TrickCard => ({
    playerId,
    card,
});

function step(s: TarotState, action: TarotAction) {
    return dispatch(tarot, s, action, action.playerId);
}
function ok(s: TarotState, action: TarotAction): TarotState {
    const res = step(s, action);
    if (!res.ok) throw new Error(`unexpected refusal: ${res.error.code}`);
    return res.state;
}

/** Drive the game with a chooser (default: first legal action) until it ends,
 * collecting the action log for replay checks. */
function playOut(
    start: TarotState,
    chooser: (
        legal: readonly TarotAction[],
        state: TarotState,
    ) => TarotAction = (legal) => legal[0],
): { state: TarotState; actions: TarotAction[] } {
    let state = start;
    const actions: TarotAction[] = [];
    let guard = 0;
    while (!tarot.isOver(state) && guard++ < 500) {
        const who = state.currentPlayerId;
        const legal = tarot.legalActions(state, who);
        if (legal.length === 0) throw new Error(`stuck at ${state.phase}`);
        const action = chooser(legal, state);
        actions.push(action);
        state = ok(state, action);
    }
    return { state, actions };
}

describe("setup & deal", () => {
    it("deals 78 cards into hands of 18 plus a six-card chien (4p)", () => {
        const s = createGame(tarot, P4, 1, "g");
        const inHands = Object.values(s.hands).reduce(
            (n, h) => n + h.length,
            0,
        );
        expect(inHands).toBe(72);
        expect(s.chien.length).toBe(6);
        for (const p of P4) expect(s.hands[p.id].length).toBe(18);
        expect(s.phase).toBe("bidding");
        expect(s.currentPlayerId).toBe("a"); // eldest opens the bidding
    });

    it("deals hands of 24 for three players", () => {
        const s = createGame(tarot, P3, 1, "g");
        for (const p of P3) expect(s.hands[p.id].length).toBe(24);
        expect(s.chien.length).toBe(6);
    });

    it("is deterministic — same seed deals the same cards", () => {
        const a = createGame(tarot, P4, 4242, "g");
        const b = createGame(tarot, P4, 4242, "g");
        expect(a.hands).toEqual(b.hands);
        expect(a.chien).toEqual(b.chien);
    });

    it("uses every card of the deck exactly once", () => {
        const s = createGame(tarot, P4, 7, "g");
        const all = [...Object.values(s.hands).flat(), ...s.chien];
        expect(new Set(all.map(cardKey)).size).toBe(78);
    });
});

describe("bidding", () => {
    const fresh = () => createGame(tarot, P4, 1, "g");

    it("offers every overcall plus pass to the opener", () => {
        const s = fresh();
        const legal = tarot.legalActions(s, "a");
        const kinds = legal.map((x) => (x.type === "bid" ? x.bid : x.type));
        expect(kinds).toEqual([
            "petite",
            "garde",
            "garde-sans",
            "garde-contre",
            "pass",
        ]);
    });

    it("only lets a later player overcall strictly higher", () => {
        let s = fresh();
        s = ok(s, { type: "bid", playerId: "a", bid: "garde" });
        const legal = tarot
            .legalActions(s, "b")
            .map((x) => (x.type === "bid" ? x.bid : x.type));
        expect(legal).toEqual(["garde-sans", "garde-contre", "pass"]);
    });

    it("refuses a bid that does not beat the standing one", () => {
        let s = fresh();
        s = ok(s, { type: "bid", playerId: "a", bid: "garde" });
        const res = step(s, { type: "bid", playerId: "b", bid: "petite" });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("bid_too_low");
    });

    it("ends the deal as a draw when everyone passes", () => {
        let s = fresh();
        for (const p of P4) s = ok(s, { type: "pass", playerId: p.id });
        expect(s.phase).toBe("done");
        expect(s.passedOut).toBe(true);
        const outcome = tarot.outcome(s);
        expect(outcome?.winners.length).toBe(4); // a void deal ranks everyone 1st
        expect(outcome?.rankings.every((r) => r.rank === 1)).toBe(true);
    });

    it("hands Petite/Garde to the dog with the chien in the taker's hand", () => {
        let s = fresh();
        s = ok(s, { type: "bid", playerId: "a", bid: "petite" });
        s = ok(s, { type: "pass", playerId: "b" });
        s = ok(s, { type: "pass", playerId: "c" });
        s = ok(s, { type: "pass", playerId: "d" });
        expect(s.phase).toBe("dog");
        expect(s.taker).toBe("a");
        expect(s.contract).toBe("petite");
        expect(s.hands.a.length).toBe(24); // 18 + the six chien cards
    });

    it("skips the dog on Garde Contre and leads straight into the tricks", () => {
        let s = fresh();
        s = ok(s, { type: "bid", playerId: "a", bid: "garde-contre" });
        s = ok(s, { type: "pass", playerId: "b" });
        s = ok(s, { type: "pass", playerId: "c" });
        s = ok(s, { type: "pass", playerId: "d" });
        expect(s.phase).toBe("playing");
        expect(s.taker).toBe("a");
        expect(s.hands.a.length).toBe(18); // chien untouched
        expect(s.currentPlayerId).toBe("a"); // eldest leads trick one
    });

    it("disables Garde Sans/Contre when the rule is off", () => {
        const noSans = tarot.withRules?.({
            gardeSansContre: false,
            petitAuBout: true,
            slam: true,
        });
        if (!noSans) throw new Error("withRules missing");
        const s = createGame(noSans, P4, 1, "g");
        const kinds = noSans
            .legalActions(s, "a")
            .map((x) => (x.type === "bid" ? x.bid : x.type));
        expect(kinds).toEqual(["petite", "garde", "pass"]);
    });
});

describe("écart (the dog)", () => {
    function intoDog(): TarotState {
        let s = createGame(tarot, P4, 1, "g");
        s = ok(s, { type: "bid", playerId: "a", bid: "petite" });
        for (const p of ["b", "c", "d"])
            s = ok(s, { type: "pass", playerId: p });
        return s;
    }

    it("never offers a King or a bout for the écart", () => {
        const s = intoDog();
        const legal = discardableCards(s.hands.a, 0);
        for (const c of legal) {
            expect(c.type === "suited" && c.rank === "K").toBe(false);
            expect(c.type === "fool").toBe(false);
            expect(
                c.type === "trump" && (c.index === 1 || c.index === 21),
            ).toBe(false);
        }
    });

    it("refuses to bury a King", () => {
        const s = intoDog();
        const king = s.hands.a.find(
            (c) => c.type === "suited" && c.rank === "K",
        );
        if (king) {
            const res = step(s, { type: "discard", playerId: "a", card: king });
            expect(res.ok).toBe(false);
            if (!res.ok) expect(res.error.code).toBe("illegal_discard");
        }
    });

    it("returns to 18 cards and starts the tricks after six discards", () => {
        let s = intoDog();
        for (let i = 0; i < 6; i++) {
            const legal = tarot.legalActions(s, "a");
            s = ok(s, legal[0]);
        }
        expect(s.phase).toBe("playing");
        expect(s.hands.a.length).toBe(18);
        expect(s.ecart.length).toBe(6);
        expect(s.currentPlayerId).toBe("a"); // eldest leads
    });
});

describe("legalCards — jeu de la carte", () => {
    const hand: CardDescriptor[] = [
        C("K", "hearts"),
        C("3", "hearts"),
        C("9", "spades"),
        T(4),
        T(12),
        FOOL,
    ];

    it("allows anything on a fresh lead", () => {
        expect(legalCards(hand, []).length).toBe(hand.length);
    });

    it("forces following the led suit, the Excuse aside", () => {
        const pile = [tc("x", C("7", "hearts"))];
        const keys = legalCards(hand, pile).map(cardKey).sort();
        expect(keys).toEqual(
            [C("K", "hearts"), C("3", "hearts"), FOOL].map(cardKey).sort(),
        );
    });

    it("forces a trump (and over-trumping) when void in the suit", () => {
        const pile = [tc("x", C("7", "clubs")), tc("y", T(8))];
        // Void in clubs; a trump is already in play (8) → must beat it → only 12.
        const keys = legalCards(hand, pile).map(cardKey).sort();
        expect(keys).toEqual([T(12), FOOL].map(cardKey).sort());
    });

    it("permits any trump when none can over-trump", () => {
        const lowTrumps: CardDescriptor[] = [T(2), T(4), C("K", "hearts")];
        const pile = [tc("x", C("7", "clubs")), tc("y", T(9))];
        const keys = legalCards(lowTrumps, pile).map(cardKey).sort();
        expect(keys).toEqual([T(2), T(4)].map(cardKey).sort());
    });

    it("allows a discard when void in both the suit and trumps", () => {
        const noTrump: CardDescriptor[] = [C("K", "hearts"), C("9", "spades")];
        const pile = [tc("x", C("7", "clubs"))];
        expect(legalCards(noTrump, pile).length).toBe(2);
    });
});

describe("trickWinner", () => {
    it("gives the trick to the highest card of the led suit", () => {
        const plays = [
            tc("a", C("9", "hearts")),
            tc("b", C("K", "hearts")),
            tc("c", C("3", "hearts")),
            tc("d", C("2", "clubs")),
        ];
        expect(trickWinner(plays)).toBe("b");
    });

    it("lets any trump beat the led suit, highest trump winning", () => {
        const plays = [
            tc("a", C("K", "hearts")),
            tc("b", T(5)),
            tc("c", T(18)),
            tc("d", C("A", "hearts")),
        ];
        expect(trickWinner(plays)).toBe("c");
    });

    it("never lets the Excuse win", () => {
        const plays = [
            tc("a", FOOL),
            tc("b", C("3", "hearts")),
            tc("c", C("K", "hearts")),
            tc("d", C("2", "hearts")),
        ];
        expect(trickWinner(plays)).toBe("c");
    });
});

describe("turn enforcement", () => {
    it("refuses an action from a player off turn", () => {
        const s = createGame(tarot, P4, 1, "g");
        const res = step(s, { type: "pass", playerId: "b" });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("not_your_turn");
    });

    it("refuses a play during the bidding phase", () => {
        const s = createGame(tarot, P4, 1, "g");
        const res = step(s, {
            type: "play",
            playerId: "a",
            card: s.hands.a[0],
        });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("wrong_phase");
    });
});

describe("a full deal", () => {
    it("plays to completion and scores a zero-sum result", () => {
        const s = createGame(tarot, P4, 12345, "g");
        const { state } = playOut(s);
        expect(state.phase).toBe("done");
        expect(state.tricks.length).toBe(18);
        for (const p of P4) expect(state.hands[p.id].length).toBe(0);
        expect(state.result).not.toBeNull();
        const total = Object.values(state.result?.scores ?? {}).reduce(
            (sum, v) => sum + v,
            0,
        );
        expect(total).toBe(0);
        const outcome = tarot.outcome(state);
        expect(outcome?.rankings.length).toBe(4);
    });

    it("replays identically from the recorded action log", () => {
        const s = createGame(tarot, P4, 999, "g");
        const { state, actions } = playOut(s);
        const replayed = replay(tarot, P4, 999, actions, "g");
        expect(replayed).toEqual(state);
    });

    it("conserves the 91-point total across the two sides", () => {
        const s = createGame(tarot, P4, 808, "g");
        const { state } = playOut(s);
        const r = state.result;
        expect(r).not.toBeNull();
        if (r) expect(r.takerPoints + r.defencePoints).toBe(91);
    });
});

describe("view — RLS in code", () => {
    it("shows only the viewer's own hand", () => {
        const s = createGame(tarot, P4, 1, "g");
        const view = tarot.view(s, "a");
        const self = view.players.find((p) => p.playerId === "a");
        const other = view.players.find((p) => p.playerId === "b");
        expect(self?.hand?.length).toBe(18);
        expect(other?.hand).toBeUndefined();
        expect(other?.handCount).toBe(18);
    });

    it("hides the chien until it is revealed", () => {
        let s = createGame(tarot, P4, 1, "g");
        expect(tarot.view(s, "a").chien.length).toBe(0); // bidding — hidden
        s = ok(s, { type: "bid", playerId: "a", bid: "petite" });
        for (const p of ["b", "c", "d"])
            s = ok(s, { type: "pass", playerId: p });
        expect(tarot.view(s, "a").chienRevealed).toBe(true); // dog — public
        expect(tarot.view(s, "a").chien.length).toBe(6);
    });

    it("never leaks a hand to a spectator", () => {
        const s = createGame(tarot, P4, 1, "g");
        const view = tarot.view(s, null);
        expect(view.players.every((p) => p.hand === undefined)).toBe(true);
        expect(view.self).toBeNull();
    });
});
