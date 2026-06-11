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
        pile: [{ playerId: "b", cards: [card("9")] }],
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

    it("shows the top play in the trick zone, skinned by its player", () => {
        const data = presidentTable.mapView(view, ctx());
        const trick = data.zones.find((z) => z.key === "trick");
        expect(trick?.cards).toHaveLength(1);
        expect(trick?.cards[0]?.ownerId).toBe("b");
        expect(trick?.caption).toBe("Bob");
    });

    it("renders the hand only for the seated viewer", () => {
        const mine = presidentTable.mapView(view, ctx());
        expect(mine.zones.find((z) => z.key === "hand")?.cards).toHaveLength(2);

        const spectator = presidentTable.mapView(view, ctx({ viewerId: null }));
        expect(spectator.zones.find((z) => z.key === "hand")).toBeUndefined();
        expect(spectator.banner.label).toBe("spectating");
    });

    it("turns legal moves into controls on the viewer's turn only", () => {
        const mine = presidentTable.mapView(view, ctx({ legalActions: legal }));
        expect(mine.controls).toHaveLength(2);
        expect(mine.controls?.[0]?.cards).toEqual([card("J")]);
        expect(mine.controls?.[1]?.variant).toBe("danger");

        const waiting = presidentTable.mapView(
            { ...view, currentPlayerId: "b" },
            ctx({ legalActions: legal }),
        );
        expect(waiting.controls).toHaveLength(0);
        expect(waiting.banner.label).toBe("waiting_for|Bob");
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
