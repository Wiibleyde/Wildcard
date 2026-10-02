import { describe, expect, it } from "vitest";
import { clientState, createGame, dispatch } from "@/lib/engine/runner";
import type { AnyGameModule, GameAction, Player } from "@/lib/engine/types";
import { getGameModule, getGameTable } from "@/lib/games";
import type { AnyGameTableConfig, TableContext, TableData } from "./types";

/**
 * Full-game integration: simulate every registered game to completion through
 * the real engine and, at EVERY intermediate state, project the redacted view
 * through the game's table config for every seated player AND a spectator —
 * exactly what `GameTable` consumes at runtime. Catches gameplay/UI drift no
 * unit test sees: invalid zone references, duplicate card ids (broken React
 * keys + animations), controls pointing at illegal actions, empty banners.
 */

const text: TableContext["t"] = (key, values) =>
    values ? `${key}:${Object.values(values).join(",")}` : key;

function seats(n: number): Player[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        seat: i,
    }));
}

function contextFor(
    players: readonly Player[],
    viewerId: string | null,
    legalActions: readonly GameAction[],
    isOver: boolean,
): TableContext {
    return {
        viewerId,
        players: players.map((p) => ({
            userId: p.id,
            username: p.name,
            deckStyleId: "free",
        })),
        legalActions,
        isOver,
        t: text,
    };
}

function checkTableData(
    table: AnyGameTableConfig,
    data: TableData,
    legalActions: readonly GameAction[],
) {
    expect(data.banner.label.length).toBeGreaterThan(0);
    // Unknown names render as "?" — a banner must never wait for nobody.
    expect(data.banner.label).not.toContain("?");

    const templateIds = new Set(table.zones.map((z) => z.id));
    const cardIds = new Set<string>();
    const zoneKeys = new Set<string>();

    for (const zone of data.zones) {
        expect(
            templateIds.has(zone.zone),
            `unknown template "${zone.zone}"`,
        ).toBe(true);
        expect(zoneKeys.has(zone.key), `duplicate zone key "${zone.key}"`).toBe(
            false,
        );
        zoneKeys.add(zone.key);
        for (const item of zone.cards) {
            expect(cardIds.has(item.id), `duplicate card id "${item.id}"`).toBe(
                false,
            );
            cardIds.add(item.id);
            // A clickable card must dispatch one of the viewer's legal actions.
            if (item.action) {
                expect(legalActions).toContain(item.action);
            }
        }
    }

    // Every enabled control must dispatch one of the viewer's legal actions.
    // Disabled controls (e.g. the off-turn pass kept as a stable bar) carry a
    // placeholder action that is never dispatched, so they're exempt.
    for (const control of data.controls ?? []) {
        if (control.disabled) continue;
        expect(legalActions).toContain(control.action);
    }

    // Every offered combo must dispatch one of the viewer's legal actions.
    for (const zone of data.zones) {
        for (const play of zone.selection?.plays ?? []) {
            expect(legalActions).toContain(play.action);
        }
    }
}

function playThrough(
    module: AnyGameModule,
    table: AnyGameTableConfig,
    players: Player[],
    seed: number,
    pick: (legal: readonly GameAction[], step: number) => GameAction = (l) =>
        l[0],
) {
    let state = createGame(module, players, { seed });
    let guard = 0;
    let statesChecked = 0;

    while (guard++ < 10_000) {
        // Project the table for every seat and for a spectator.
        for (const viewerId of [...players.map((p) => p.id), null]) {
            const cs = clientState(module, state, viewerId);
            const ctx = contextFor(
                players,
                viewerId,
                cs.legalActions,
                cs.isOver,
            );
            checkTableData(table, table.mapView(cs.view, ctx), cs.legalActions);
        }
        statesChecked++;

        if (module.isOver(state)) break;

        const actor = state.currentPlayerId ?? players[0].id;
        const legal = module.legalActions(state, actor);
        expect(legal.length).toBeGreaterThan(0);
        const result = dispatch(module, state, pick(legal, guard), actor);
        if (!result.ok) throw new Error(result.error.code);
        state = result.state;
    }

    expect(module.isOver(state)).toBe(true);
    expect(statesChecked).toBeGreaterThan(1);
}

describe("full games rendered through table configs", () => {
    const games: ReadonlyArray<[string, number, number]> = [
        ["bataille", 2, 20260611],
        ["president", 4, 424242],
        ["tarot", 4, 31],
        ["tarot", 3, 77],
    ];
    it.each(games)(
        "%s (%i players): every state projects cleanly",
        (id, n, seed) => {
            const module = getGameModule(id);
            const table = getGameTable(id);
            if (!module || !table) throw new Error(`unregistered game "${id}"`);
            playThrough(module, table, seats(n), seed);
        },
    );

    it("solitaire: every state projects cleanly, spectator included", () => {
        const module = getGameModule("solitaire");
        const table = getGameTable("solitaire");
        if (!module || !table) throw new Error("solitaire unregistered");
        // Prefer real moves over draws; resign once the deal stalls.
        playThrough(module, table, seats(1), 2024, (legal, step) => {
            const resign = legal.find((a) => a.type === "resign");
            if (step > 300 && resign) return resign;
            return (
                legal.find((a) => a.type !== "draw" && a.type !== "resign") ??
                legal[0]
            );
        });
    });
});
