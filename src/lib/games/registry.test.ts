import { describe, expect, it } from "vitest";
import { clientState, createGame, dispatch } from "@/lib/engine/runner";
import type { GameAction, Player } from "@/lib/engine/types";
import type { PresidentView } from "@/lib/games/president/president";
import { gameCatalog, getGameModule } from "./index";

function seats(n: number): Player[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        seat: i,
    }));
}

describe("game registry", () => {
    it("exposes every native game", () => {
        expect(
            gameCatalog()
                .map((g) => g.id)
                .sort(),
        ).toEqual(["bataille", "president", "solitaire", "tarot"]);
    });

    it("plays a full bataille through the type-erased registry", () => {
        const module = getGameModule("bataille");
        expect(module).toBeDefined();
        if (!module) return;

        let state = createGame(module, seats(2), 12345);
        let guard = 0;
        while (!module.isOver(state) && guard++ < 10000) {
            const actor = state.players[0].id;
            const action: GameAction = { type: "flip", playerId: actor };
            const res = dispatch(module, state, action, actor);
            expect(res.ok).toBe(true);
            if (res.ok) state = res.state;
        }

        expect(module.isOver(state)).toBe(true);
        expect(module.outcome(state)).not.toBeNull();
        // Spectators receive no legal actions.
        expect(clientState(module, state, null).legalActions).toHaveLength(0);
    });

    it("plays président to completion using only legalActions", () => {
        const module = getGameModule("president");
        expect(module).toBeDefined();
        if (!module) return;

        let state = createGame(module, seats(4), 999);
        let guard = 0;
        while (!module.isOver(state) && guard++ < 10000) {
            const actor = state.currentPlayerId;
            expect(actor).not.toBeNull();
            if (!actor) break;
            const legal = module.legalActions(state, actor);
            expect(legal.length).toBeGreaterThan(0);
            const res = dispatch(module, state, legal[0], actor);
            expect(res.ok).toBe(true);
            if (res.ok) state = res.state;
        }

        expect(module.isOver(state)).toBe(true);
        expect(module.outcome(state)?.rankings.length).toBe(4);
    });

    it("plays tarot through its three phases using only legalActions", () => {
        const module = getGameModule("tarot");
        expect(module).toBeDefined();
        if (!module) return;

        let state = createGame(module, seats(4), 2024);
        let guard = 0;
        while (!module.isOver(state) && guard++ < 10000) {
            const actor = state.currentPlayerId;
            expect(actor).not.toBeNull();
            if (!actor) break;
            const legal = module.legalActions(state, actor);
            expect(legal.length).toBeGreaterThan(0);
            const res = dispatch(module, state, legal[0], actor);
            expect(res.ok).toBe(true);
            if (res.ok) state = res.state;
        }

        expect(module.isOver(state)).toBe(true);
        expect(module.outcome(state)?.rankings.length).toBe(4);
    });

    it("view() hides opponents' hands but reveals your own", () => {
        const module = getGameModule("president");
        expect(module).toBeDefined();
        if (!module) return;

        const state = createGame(module, seats(4), 7);
        const view = clientState(module, state, "p0").view as PresidentView;
        const me = view.players.find((p) => p.playerId === "p0");
        const other = view.players.find((p) => p.playerId === "p1");

        expect(me?.hand).toBeDefined();
        expect(other?.hand).toBeUndefined();
    });

    it("rejects an action whose actor is not the authenticated user", () => {
        const module = getGameModule("president");
        expect(module).toBeDefined();
        if (!module) return;

        const state = createGame(module, seats(4), 7);
        const someoneElse = state.players[0].id;
        const action: GameAction = { type: "pass", playerId: someoneElse };
        // actorId differs from the action's claimed playerId → refused.
        const res = dispatch(module, state, action, "intruder");
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe("identity_mismatch");
    });
});
