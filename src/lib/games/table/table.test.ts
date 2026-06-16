import { describe, expect, it } from "vitest";
import type { CardDescriptor, Rank } from "@/lib/card/types";
import { GAME_TABLES, GAMES } from "@/lib/games";
import type { BatailleView } from "@/lib/games/bataille/bataille";
import { batailleTable } from "@/lib/games/bataille/table";
import {
    DEFAULT_PRESIDENT_RULES,
    type PresidentAction,
    type PresidentView,
} from "@/lib/games/president/president";
import { presidentTable } from "@/lib/games/president/table";
import type { TableContext } from "./types";

function card(rank: Rank): CardDescriptor {
    return { type: "suited", suit: "spades", rank };
}

function ctx(overrides: Partial<TableContext> = {}): TableContext {
    return {
        viewerId: "a",
        players: [
            { userId: "a", username: "Alice", deckStyleId: "free" },
            { userId: "b", username: "Bob", deckStyleId: "creator" },
            { userId: "c", username: "Carl", deckStyleId: "free" },
        ],
        legalActions: [],
        isOver: false,
        t: (key, values) =>
            values ? `${key}|${Object.values(values).join(",")}` : key,
        ...overrides,
    };
}

describe("game table catalog", () => {
    it("declares a table config for every registered game", () => {
        for (const id of Object.keys(GAMES)) {
            expect(
                GAME_TABLES[id],
                `missing table config for "${id}"`,
            ).toBeDefined();
        }
    });
});

describe("bataille table", () => {
    const view: BatailleView = {
        gameId: "g",
        phase: "reveal",
        turn: 1,
        lastWinner: "b",
        self: "a",
        players: [
            {
                playerId: "a",
                name: "Alice",
                drawCount: 20,
                wonCount: 5,
                total: 25,
                lastReveal: [card("K")],
            },
            {
                playerId: "b",
                name: "Bob",
                drawCount: 22,
                wonCount: 5,
                total: 27,
                lastReveal: [card("A")],
            },
        ],
    };

    it("emits one reveal zone per player, cards skinned by their owner", () => {
        const data = batailleTable.mapView(view, ctx());
        expect(data.zones.map((z) => z.key)).toEqual(["reveal:a", "reveal:b"]);
        expect(data.zones[1].cards[0]?.ownerId).toBe("b");
        // Every instance references a declared template.
        const templateIds = new Set(batailleTable.zones.map((z) => z.id));
        for (const zone of data.zones) {
            expect(templateIds.has(zone.zone)).toBe(true);
        }
    });

    it("offers the flip control while the round runs, none when over", () => {
        const flip = { type: "flip", playerId: "a" } as const;
        const running = batailleTable.mapView(
            view,
            ctx({ legalActions: [flip] }),
        );
        expect(running.controls).toHaveLength(1);
        expect(running.controls?.[0]?.action).toBe(flip);

        const over = batailleTable.mapView(
            view,
            ctx({ legalActions: [flip], isOver: true }),
        );
        expect(over.controls).toHaveLength(0);
        expect(over.banner.label).toBe("game_over");
    });

    it("surfaces the round result as the status line", () => {
        const data = batailleTable.mapView(view, ctx());
        expect(data.status).toBe("last_winner|Bob");
    });
});

describe("president table", () => {
    const view: PresidentView = {
        gameId: "g",
        phase: "playing",
        turn: 3,
        currentPlayerId: "a",
        rules: DEFAULT_PRESIDENT_RULES,
        combo: { rank: "9", count: 1 },
        revolution: false,
        equalLock: false,
        pile: [
            { playerId: "c", cards: [card("8")] },
            { playerId: "b", cards: [card("9")] },
        ],
        finished: [],
        self: "a",
        players: [
            {
                playerId: "a",
                name: "Alice",
                handCount: 2,
                passed: false,
                place: null,
                demoted: false,
                hand: [card("J"), card("Q")],
            },
            {
                playerId: "b",
                name: "Bob",
                handCount: 3,
                passed: true,
                place: null,
                demoted: false,
            },
            {
                playerId: "c",
                name: "Carl",
                handCount: 0,
                passed: false,
                place: null,
                demoted: true,
            },
        ],
    };

    const legal: PresidentAction[] = [
        { type: "play", playerId: "a", cards: [card("J")] },
        { type: "pass", playerId: "a" },
    ];

    it("shows the whole trick pile, each play skinned by its player", () => {
        const data = presidentTable.mapView(view, ctx());
        const trick = data.zones.find((z) => z.key === "trick");
        expect(trick?.cards).toHaveLength(2);
        expect(trick?.cards.map((c) => c.ownerId)).toEqual(["c", "b"]);
        expect(trick?.caption).toBe("Bob"); // caption names the top play
    });

    it("renders the hand only for the seated viewer", () => {
        const mine = presidentTable.mapView(view, ctx());
        expect(mine.zones.find((z) => z.key === "hand")?.cards).toHaveLength(2);

        const spectator = presidentTable.mapView(view, ctx({ viewerId: null }));
        expect(spectator.zones.find((z) => z.key === "hand")).toBeUndefined();
        expect(spectator.banner.label).toBe("spectating");
    });

    it("builds combos from the hand and keeps only pass as a control", () => {
        const mine = presidentTable.mapView(view, ctx({ legalActions: legal }));

        // No combo is pre-proposed — pass is the only control left.
        expect(mine.controls).toHaveLength(1);
        expect(mine.controls?.[0]?.variant).toBe("danger");

        const hand = mine.zones.find((z) => z.key === "hand");
        // The hand is a tap-to-build picker advertising the legal combos.
        expect(hand?.selection?.playLabel).toBe("play");
        expect(hand?.selection?.plays).toEqual([
            { group: "J", count: 1, action: legal[0] },
        ]);

        // A card whose rank has a legal play is selectable; the other is
        // flagged illegal so a click can explain itself.
        const byRank = (r: Rank) =>
            hand?.cards.find(
                (c) => c.card.type === "suited" && c.card.rank === r,
            );
        expect(byRank("J")?.group).toBe("J");
        expect(byRank("J")?.illegal).toBeFalsy();
        expect(byRank("Q")?.group).toBeUndefined();
        expect(byRank("Q")?.illegal).toBe(true);

        const waiting = presidentTable.mapView(
            { ...view, currentPlayerId: "b" },
            ctx({ legalActions: legal }),
        );
        expect(waiting.controls).toHaveLength(0);
        expect(waiting.banner.label).toBe("waiting_for|Bob");
        // Not your turn → no picker, cards inert and never flagged illegal.
        const waitingHand = waiting.zones.find((z) => z.key === "hand");
        expect(waitingHand?.selection).toBeUndefined();
        expect(waitingHand?.cards.every((c) => !c.illegal)).toBe(true);
    });

    it("labels seats: passed opponents and demoted players", () => {
        const data = presidentTable.mapView(view, ctx());
        expect(data.seats?.map((s) => s.playerId)).toEqual(["b", "c"]);
        const bob = data.seats?.find((s) => s.playerId === "b");
        const carl = data.seats?.find((s) => s.playerId === "c");
        expect(bob?.status).toBe("passed");
        expect(carl?.status).toBe("place_asshole");
    });
});

describe("history log lines", () => {
    const line = (type: string, payload?: Record<string, unknown>) =>
        presidentTable.logLine?.({ type, payload }, ctx());

    it("narrates plays with localized rank labels and counts", () => {
        expect(line("played", { playerId: "b", rank: "Q", count: 1 })).toBe(
            "log_played_one|Bob,rank_Q",
        );
        expect(line("played", { playerId: "a", rank: "8", count: 2 })).toBe(
            "log_played_many|Alice,8,2",
        );
    });

    it("narrates passes, sweeps and revolutions", () => {
        expect(line("passed", { playerId: "c" })).toBe("log_passed|Carl");
        expect(line("trick_cleared", { leadPlayerId: "a" })).toBe(
            "log_trick_cleared|Alice",
        );
        expect(line("revolution", { active: true })).toBe("log_revolution");
        expect(line("revolution", { active: false })).toBe(
            "log_counter_revolution",
        );
    });

    it("narrates the « ou rien » lock with the locked rank", () => {
        expect(line("or_nothing", { playerId: "b", rank: "Q" })).toBe(
            "log_or_nothing|Bob,rank_Q",
        );
    });

    it("crowns finishers with their title when one applies", () => {
        // 3 players: place 1 = Président, no vice titles.
        expect(line("finished", { playerId: "b", place: 1 })).toBe(
            "log_finished_title|Bob,place_president",
        );
        expect(line("finished", { playerId: "b", place: 2 })).toBe(
            "log_finished|Bob,2",
        );
    });

    it("hides unknown event types instead of leaking raw names", () => {
        expect(line("internal_thing")).toBeNull();
    });

    it("narrates bataille rounds: winner or tie, flips hidden", () => {
        const bLine = (type: string, payload?: Record<string, unknown>) =>
            batailleTable.logLine?.({ type, payload }, ctx());
        expect(bLine("round_resolved", { winner: "b", round: 4 })).toBe(
            "log_round_won|Bob,4",
        );
        expect(bLine("round_resolved", { winner: null, round: 5 })).toBe(
            "log_round_draw|5",
        );
        expect(bLine("flip", { playerId: "a" })).toBeNull();
    });
});
