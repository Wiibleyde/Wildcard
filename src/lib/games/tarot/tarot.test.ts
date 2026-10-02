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
        const s = createGame(tarot, P4, { seed: 1, gameId: "g" });
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
        const s = createGame(tarot, P3, { seed: 1, gameId: "g" });
        for (const p of P3) expect(s.hands[p.id].length).toBe(24);
        expect(s.chien.length).toBe(6);
    });

    it("is deterministic — same seed deals the same cards", () => {
        const a = createGame(tarot, P4, { seed: 4242, gameId: "g" });
        const b = createGame(tarot, P4, { seed: 4242, gameId: "g" });
        expect(a.hands).toEqual(b.hands);
        expect(a.chien).toEqual(b.chien);
    });

    it("uses every card of the deck exactly once", () => {
        const s = createGame(tarot, P4, { seed: 7, gameId: "g" });
        const all = [...Object.values(s.hands).flat(), ...s.chien];
        expect(new Set(all.map(cardKey)).size).toBe(78);
    });
});

describe("bidding", () => {
    const fresh = () => createGame(tarot, P4, { seed: 1, gameId: "g" });

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

    it("redeals from the seeded RNG when everyone passes", () => {
        let s = fresh();
        const before = s;
        for (const p of P4) s = ok(s, { type: "pass", playerId: p.id });
        // Not a finished game: no void "draw" ever reaches ELO/history.
        expect(s.phase).toBe("bidding");
        expect(tarot.isOver(s)).toBe(false);
        expect(tarot.outcome(s)).toBeNull();
        expect(s.redeals).toBe(1);
        expect(s.bids).toEqual({});
        // The deal moves one seat on: B is now eldest and opens the bidding.
        expect(s.eldestId).toBe("b");
        expect(s.currentPlayerId).toBe("b");
        // A fresh, complete deck — and the RNG cursor advanced.
        expect(s.hands).not.toEqual(before.hands);
        expect(s.rngState).not.toBe(before.rngState);
        const all = [...Object.values(s.hands).flat(), ...s.chien];
        expect(new Set(all.map(cardKey)).size).toBe(78);
        for (const p of P4) expect(s.hands[p.id].length).toBe(18);
    });

    it("bids clockwise from the new eldest after a redeal", () => {
        let s = fresh();
        for (const p of P4) s = ok(s, { type: "pass", playerId: p.id });
        s = ok(s, { type: "pass", playerId: "b" });
        expect(s.currentPlayerId).toBe("c");
        s = ok(s, { type: "bid", playerId: "c", bid: "garde-sans" });
        s = ok(s, { type: "pass", playerId: "d" });
        s = ok(s, { type: "pass", playerId: "a" });
        // FFT: the taker first says whether they announce a slam.
        expect(s.phase).toBe("slam");
        s = ok(s, { type: "pass", playerId: "c" });
        expect(s.phase).toBe("playing");
        expect(s.taker).toBe("c");
        // The new eldest leads the first trick.
        expect(s.currentPlayerId).toBe("b");
        expect(s.trickLeaderId).toBe("b");
    });

    it("replays a redealt game identically", () => {
        let s = createGame(tarot, P4, { seed: 31, gameId: "g" });
        const actions: TarotAction[] = P4.map((p) => ({
            type: "pass",
            playerId: p.id,
        }));
        for (const a of actions) s = ok(s, a);
        expect(replay(tarot, P4, 31, actions, { gameId: "g" })).toEqual(s);
    });

    it("refuses an unknown contract", () => {
        const res = step(fresh(), {
            type: "bid",
            playerId: "a",
            bid: "toString" as unknown as "petite",
        });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("bad_bid");
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
        expect(s.phase).toBe("slam");
        s = ok(s, { type: "pass", playerId: "a" }); // no slam
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
        const s = createGame(noSans, P4, { seed: 1, gameId: "g" });
        const kinds = noSans
            .legalActions(s, "a")
            .map((x) => (x.type === "bid" ? x.bid : x.type));
        expect(kinds).toEqual(["petite", "garde", "pass"]);
    });
});

describe("écart (the dog)", () => {
    function intoDog(): TarotState {
        let s = createGame(tarot, P4, { seed: 1, gameId: "g" });
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
        expect(s.phase).toBe("slam");
        s = ok(s, { type: "pass", playerId: "a" }); // no slam
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
        const s = createGame(tarot, P4, { seed: 1, gameId: "g" });
        const res = step(s, { type: "pass", playerId: "b" });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("not_your_turn");
    });

    it("refuses a play during the bidding phase", () => {
        const s = createGame(tarot, P4, { seed: 1, gameId: "g" });
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
        const s = createGame(tarot, P4, { seed: 12345, gameId: "g" });
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
        const s = createGame(tarot, P4, { seed: 999, gameId: "g" });
        const { state, actions } = playOut(s);
        const replayed = replay(tarot, P4, 999, actions, { gameId: "g" });
        expect(replayed).toEqual(state);
    });

    it("conserves the 91-point total across the two sides", () => {
        const s = createGame(tarot, P4, { seed: 808, gameId: "g" });
        const { state } = playOut(s);
        const r = state.result;
        expect(r).not.toBeNull();
        if (r) expect(r.takerPoints + r.defencePoints).toBe(91);
    });
});

describe("view — RLS in code", () => {
    it("shows only the viewer's own hand", () => {
        const s = createGame(tarot, P4, { seed: 1, gameId: "g" });
        const view = tarot.view(s, "a");
        const self = view.players.find((p) => p.playerId === "a");
        const other = view.players.find((p) => p.playerId === "b");
        expect(self?.hand?.length).toBe(18);
        expect(other?.hand).toBeUndefined();
        expect(other?.handCount).toBe(18);
    });

    it("hides the chien until it is revealed", () => {
        let s = createGame(tarot, P4, { seed: 1, gameId: "g" });
        expect(tarot.view(s, "a").chien.length).toBe(0); // bidding — hidden
        s = ok(s, { type: "bid", playerId: "a", bid: "petite" });
        for (const p of ["b", "c", "d"])
            s = ok(s, { type: "pass", playerId: p });
        expect(tarot.view(s, "a").chienRevealed).toBe(true); // dog — public
        expect(tarot.view(s, "a").chien.length).toBe(6);
    });

    it("never leaks a hand to a spectator", () => {
        const s = createGame(tarot, P4, { seed: 1, gameId: "g" });
        const view = tarot.view(s, null);
        expect(view.players.every((p) => p.hand === undefined)).toBe(true);
        expect(view.self).toBeNull();
    });
});

/** A hand-built trick-play position: Garde Sans (no écart), A takes, A leads. */
function playing(
    hands: Record<string, CardDescriptor[]>,
    patch: Partial<TarotState> = {},
): TarotState {
    const base = createGame(tarot, P4, { seed: 1, gameId: "g" });
    return {
        ...base,
        phase: "playing",
        taker: "a",
        contract: "garde-sans",
        bids: { a: "garde-sans", b: "pass", c: "pass", d: "pass" },
        hands,
        chien: [],
        currentPlayerId: "a",
        trickLeaderId: "a",
        ...patch,
    };
}

describe("client cards are untrusted — canonical cards only", () => {
    it("refuses a lookalike Petit sent with a string index", () => {
        const s = playing(
            {
                a: [C("K", "hearts")],
                b: [T(1)],
                c: [C("2", "hearts")],
                d: [C("3", "hearts")],
            },
            { currentPlayerId: "b" },
        );
        const res = step(s, {
            type: "play",
            playerId: "b",
            card: { type: "trump", index: "1" } as unknown as CardDescriptor,
        });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("not_in_hand");
    });

    it("stores the held card, never the client's object (junk fields dropped)", () => {
        const s = playing({
            a: [C("K", "hearts"), FOOL],
            b: [C("2", "hearts"), C("3", "clubs")],
            c: [C("4", "hearts"), C("5", "clubs")],
            d: [C("6", "hearts"), C("7", "clubs")],
        });
        const sent = {
            type: "suited",
            suit: "hearts",
            rank: "K",
            junk: "<script>",
        } as unknown as CardDescriptor;
        const res = step(s, { type: "play", playerId: "a", card: sent });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.pile[0].card).toEqual(C("K", "hearts"));
        expect(res.state.pile[0].card).not.toBe(sent);
        expect(res.state.pile[0].card).not.toHaveProperty("junk");
        const played = res.events.find((e) => e.type === "played");
        expect(played?.payload?.card).toEqual(C("K", "hearts"));
    });

    it("buries the canonical card in the écart", () => {
        let s = createGame(tarot, P4, { seed: 1, gameId: "g" });
        s = ok(s, { type: "bid", playerId: "a", bid: "petite" });
        for (const p of ["b", "c", "d"])
            s = ok(s, { type: "pass", playerId: p });
        const target = discardableCards(s.hands.a, 0)[0];
        const res = step(s, {
            type: "discard",
            playerId: "a",
            card: { ...target, extra: 1 } as unknown as CardDescriptor,
        });
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.state.ecart).toEqual([target]);
    });

    it("refuses a malformed card payload without throwing", () => {
        const s = playing({
            a: [C("K", "hearts")],
            b: [C("2", "hearts")],
            c: [C("4", "hearts")],
            d: [C("6", "hearts")],
        });
        for (const card of [null, "K", { type: "suited" }, { type: "x" }]) {
            const res = step(s, {
                type: "play",
                playerId: "a",
                card: card as unknown as CardDescriptor,
            });
            expect(res.ok).toBe(false);
        }
    });
});

describe("Excuse au chelem", () => {
    it("lets a side that swept every trick win the last one by leading the Excuse", () => {
        const plays = [
            tc("a", FOOL),
            tc("b", C("K", "hearts")),
            tc("c", T(3)),
            tc("d", C("2", "hearts")),
        ];
        expect(
            trickWinner(plays, { isLastTrick: true, leaderSideWonAll: true }),
        ).toBe("a");
        // Not the last trick, or not a sweep: the Excuse never wins.
        expect(
            trickWinner(plays, { isLastTrick: false, leaderSideWonAll: true }),
        ).toBe("c");
        expect(
            trickWinner(plays, { isLastTrick: true, leaderSideWonAll: false }),
        ).toBe("c");
        // Played but not led: no exception.
        expect(
            trickWinner([plays[1], plays[0], plays[2], plays[3]], {
                isLastTrick: true,
                leaderSideWonAll: true,
            }),
        ).toBe("c");
    });

    it("keeps the taker's chelem when they lead the Excuse to the last trick", () => {
        let s = playing({
            a: [T(21), FOOL],
            b: [C("2", "hearts"), C("K", "hearts")],
            c: [C("3", "clubs"), T(5)],
            d: [C("4", "spades"), C("5", "spades")],
        });
        s = ok(s, { type: "play", playerId: "a", card: T(21) });
        s = ok(s, { type: "play", playerId: "b", card: C("2", "hearts") });
        s = ok(s, { type: "play", playerId: "c", card: T(5) });
        s = ok(s, { type: "play", playerId: "d", card: C("4", "spades") });
        expect(s.currentPlayerId).toBe("a"); // won trick one, leads the last
        s = ok(s, { type: "play", playerId: "a", card: FOOL });
        s = ok(s, { type: "play", playerId: "b", card: C("K", "hearts") });
        s = ok(s, { type: "play", playerId: "c", card: C("3", "clubs") });
        s = ok(s, { type: "play", playerId: "d", card: C("5", "spades") });
        expect(s.phase).toBe("done");
        expect(s.tricks.map((t) => t.winnerId)).toEqual(["a", "a"]);
        expect(s.result?.chelem).toBe(200);
    });

    it("lets the Excuse lose the last trick when the leader's side dropped one", () => {
        let s = playing({
            a: [T(2), FOOL],
            b: [T(21), C("K", "hearts")],
            c: [C("3", "clubs"), C("4", "clubs")],
            d: [C("4", "spades"), C("5", "spades")],
        });
        s = ok(s, { type: "play", playerId: "a", card: T(2) });
        s = ok(s, { type: "play", playerId: "b", card: T(21) });
        s = ok(s, { type: "play", playerId: "c", card: C("3", "clubs") });
        s = ok(s, { type: "play", playerId: "d", card: C("4", "spades") });
        // B (defence) won trick one and leads; A drops the Excuse last.
        s = ok(s, { type: "play", playerId: "b", card: C("K", "hearts") });
        s = ok(s, { type: "play", playerId: "c", card: C("4", "clubs") });
        s = ok(s, { type: "play", playerId: "d", card: C("5", "spades") });
        s = ok(s, { type: "play", playerId: "a", card: FOOL });
        expect(s.tricks.map((t) => t.winnerId)).toEqual(["b", "b"]);
        expect(s.result?.chelem).toBe(-200);
    });
});

describe("rules binding", () => {
    it("withRules keeps only the declared rule keys", () => {
        const bound = tarot.withRules?.({ slam: false, junk: true });
        const s = createGame(bound ?? tarot, P4, { seed: 1, gameId: "g" });
        expect(s.rules).toEqual({
            gardeSansContre: true,
            petitAuBout: true,
            slam: false,
        });
    });
});
