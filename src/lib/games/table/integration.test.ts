import { describe, expect, it } from "vitest";
import { clientState, createGame, dispatch } from "@/lib/engine/runner";
import type { AnyGameModule, GameAction, Player } from "@/lib/engine/types";
import { GAME_TABLES, GAMES } from "@/lib/games";
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
        }
    }

    // Every control must dispatch one of the viewer's legal actions.
    for (const control of data.controls ?? []) {
        expect(legalActions).toContain(control.action);
    }
}

function playThrough(
    module: AnyGameModule,
    table: AnyGameTableConfig,
    players: Player[],
    seed: number,
) {
    let state = createGame(module, players, seed);
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
        const result = dispatch(module, state, legal[0], actor);
        if (!result.ok) throw new Error(result.error.code);
        state = result.state;
    }

    expect(module.isOver(state)).toBe(true);
    expect(statesChecked).toBeGreaterThan(1);
}

describe("full games rendered through table configs", () => {
    it("bataille: every state projects cleanly for all viewers", () => {
        const module = GAMES.bataille;
        playThrough(module, GAME_TABLES.bataille, seats(2), 20260611);
    });

    it("président: every state projects cleanly for all viewers", () => {
        const module = GAMES.president;
        playThrough(module, GAME_TABLES.president, seats(4), 424242);
    });
});
