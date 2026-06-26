import { describe, expect, it } from "vitest";
import type { CardDescriptor } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { createGame, dispatch } from "@/lib/engine/runner";
import type { Player } from "@/lib/engine/types";
import { type PresidentView, president } from "./president/president";
import { presidentTable } from "./president/table";
import { type SolitaireView, solitaire } from "./solitaire/solitaire";
import { solitaireTable } from "./solitaire/table";

/**
 * Guard for the optimistic `predict` layer (UI-first moves, see
 * `GameTableConfig.predict`). Drives real games and asserts that every non-null
 * prediction agrees with the authoritative `apply → view` on the fields the
 * prediction commits to. A regression in a predictor here is a board that lies
 * to the player for a beat before the server snaps it back — caught at build.
 */

const sortKeys = (cards: readonly CardDescriptor[]): string[] =>
    cards.map(cardKey).sort();

describe("president — predict matches apply on the viewer's hand", () => {
    const P4: Player[] = [
        { id: "a", name: "A", seat: 0 },
        { id: "b", name: "B", seat: 1 },
        { id: "c", name: "C", seat: 2 },
        { id: "d", name: "D", seat: 3 },
    ];

    it("the played cards always leave the hand exactly", () => {
        let cases = 0;
        for (const seed of [1, 7, 42, 1234, 90210]) {
            let state = createGame(president, P4, seed);
            for (let step = 0; step < 60 && !president.isOver(state); step++) {
                const actor = state.currentPlayerId;
                const legal = president.legalActions(state, actor);
                if (legal.length === 0) break;
                const view = president.view(state, actor) as PresidentView;

                // Every legal action's prediction must keep the actor's hand in
                // sync with the real reducer — the core "my cards left" promise.
                for (const action of legal) {
                    const predicted = presidentTable.predict?.(
                        view,
                        action,
                        actor,
                    ) as PresidentView | null;
                    expect(predicted).not.toBeNull();
                    if (!predicted) continue;

                    const result = dispatch(president, state, action, actor);
                    expect(result.ok).toBe(true);
                    if (!result.ok) continue;
                    const real = president.view(
                        result.state,
                        actor,
                    ) as PresidentView;

                    const predSelf = predicted.players.find(
                        (p) => p.playerId === actor,
                    );
                    const realSelf = real.players.find(
                        (p) => p.playerId === actor,
                    );
                    expect(predSelf?.handCount).toBe(realSelf?.handCount);
                    expect(sortKeys(predSelf?.hand ?? [])).toEqual(
                        sortKeys(realSelf?.hand ?? []),
                    );
                    cases++;
                }

                // Advance one move (prefer playing so the game progresses).
                const next = legal.find((a) => a.type === "play") ?? legal[0];
                const stepped = dispatch(president, state, next, actor);
                if (!stepped.ok) break;
                state = stepped.state;
            }
        }
        expect(cases).toBeGreaterThan(40);
    });
});

describe("solitaire — predict matches apply on the whole board", () => {
    const players: Player[] = [{ id: "solo", name: "Solo", seat: 0 }];

    // The board fields a non-null solitaire prediction is fully responsible for:
    // nothing hidden moves, so these must match the server exactly.
    const board = (v: SolitaireView) => ({
        stockCount: v.stockCount,
        waste: v.waste,
        foundations: v.foundations,
        tableau: v.tableau,
    });

    it("predicted board equals the real board for every predicted move", () => {
        let cases = 0;
        for (const seed of [1, 2, 7, 42, 99, 2024]) {
            let state = createGame(solitaire, players, seed);
            for (let step = 0; step < 120 && !solitaire.isOver(state); step++) {
                const legal = solitaire.legalActions(state, "solo");
                if (legal.length === 0) break;
                const view = solitaire.view(state, "solo") as SolitaireView;

                for (const action of legal) {
                    const predicted = solitaireTable.predict?.(
                        view,
                        action,
                        "solo",
                    ) as SolitaireView | null;
                    if (!predicted) continue; // opted out (hidden reveal)

                    const result = dispatch(solitaire, state, action, "solo");
                    expect(result.ok).toBe(true);
                    if (!result.ok) continue;
                    const real = solitaire.view(
                        result.state,
                        "solo",
                    ) as SolitaireView;
                    expect(board(predicted)).toEqual(board(real));
                    cases++;
                }

                // Advance: prefer a board move, fall back to drawing/recycling.
                const next =
                    legal.find((a) => a.type !== "draw") ??
                    legal.find((a) => a.type === "draw") ??
                    legal[0];
                const stepped = dispatch(solitaire, state, next, "solo");
                if (!stepped.ok) break;
                state = stepped.state;
            }
        }
        expect(cases).toBeGreaterThan(20);
    });
});
