import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createGame, dispatch } from "@/lib/engine/runner";
import type { GameState, Player } from "@/lib/engine/types";
import {
    type PresidentAction,
    type PresidentState,
    president,
} from "@/lib/games/president/president";
import type { Database } from "@/lib/supabase/types";
import { getGameSync } from "./game";

const FOUR: Player[] = [
    { id: "a", name: "A", seat: 0 },
    { id: "b", name: "B", seat: 1 },
    { id: "c", name: "C", seat: 2 },
    { id: "d", name: "D", seat: 3 },
];

interface LogRow {
    seq: number;
    actor_id: string;
    action: PresidentAction;
    events: unknown[];
}

/** Play `moves` legal president moves; returns every state and the log. */
function play(moves: number) {
    let state = createGame(president, FOUR, { seed: 99, gameId: "g1" });
    const states: PresidentState[] = [state];
    const log: LogRow[] = [];
    for (let i = 0; i < moves; i++) {
        const action = president.legalActions(state, state.currentPlayerId)[0];
        const result = dispatch(president, state, action, action.playerId);
        if (!result.ok) throw new Error(result.error.code);
        state = result.state;
        states.push(state);
        log.push({
            seq: i + 1,
            actor_id: action.playerId,
            action,
            events: [...result.events],
        });
    }
    return { states, log };
}

/**
 * Minimal PostgREST stand-in: every filter method chains, `maybeSingle()`
 * resolves the `games` row, and awaiting a list query applies the `lte` /
 * `order` / `limit` it was built with.
 */
function fakeAdmin(state: GameState, log: LogRow[]): SupabaseClient<Database> {
    const from = (table: string) => {
        let lte = Number.POSITIVE_INFINITY;
        let ascending = true;
        let limit = Number.POSITIVE_INFINITY;
        const rows = (): unknown[] => {
            if (table === "game_actions") {
                const out = log.filter((r) => r.seq <= lte);
                if (!ascending) out.reverse();
                return out.slice(0, limit);
            }
            return [];
        };
        const builder = {
            select: () => builder,
            eq: () => builder,
            in: () => builder,
            lte: (_col: string, v: number) => {
                lte = v;
                return builder;
            },
            order: (_col: string, o: { ascending: boolean }) => {
                ascending = o.ascending;
                return builder;
            },
            limit: (n: number) => {
                limit = n;
                return builder;
            },
            maybeSingle: async () => ({
                data: {
                    id: "g1",
                    room_id: "r1",
                    module_id: president.id,
                    version: log.at(-1)?.seq ?? 0,
                    is_over: false,
                    bot_ids: [],
                    winner_ids: [],
                    end_reason: null,
                    forfeited_by: null,
                    created_at: null,
                    updated_at: new Date().toISOString(),
                    game_states: { state },
                    rooms: { code: "ABCD" },
                },
                error: null,
            }),
            // biome-ignore lint/suspicious/noThenProperty: a PostgREST builder is awaited as a thenable
            then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
                resolve({ data: rows(), error: null }),
        };
        return builder;
    };
    return { from } as unknown as SupabaseClient<Database>;
}

describe("getGameSync catch-up frames", () => {
    it("re-derives each missed move as the viewer's redacted view", async () => {
        const { states, log } = play(5);
        const head = states[5];
        const res = await getGameSync(fakeAdmin(head, log), "g1", "a", 2);
        if (!res.ok) throw new Error(res.error);

        // Versions 3 and 4 are between `since` (2) and the head (5).
        expect(res.payload.frames.map((f) => f.version)).toEqual([3, 4]);
        for (const frame of res.payload.frames) {
            const s = states[frame.version];
            expect(frame.view).toEqual(president.view(s, "a"));
            expect(frame.currentPlayerId).toBe(s.currentPlayerId);
        }
        expect(res.payload.version).toBe(5);
        expect(res.payload.view).toEqual(president.view(head, "a"));
    });

    it("computes nothing when the client is only one move behind", async () => {
        const { states, log } = play(4);
        const res = await getGameSync(fakeAdmin(states[4], log), "g1", "a", 3);
        if (!res.ok) throw new Error(res.error);
        expect(res.payload.frames).toEqual([]);
    });

    it("caps a long gap to the most recent moves", async () => {
        const { states, log } = play(20);
        const res = await getGameSync(fakeAdmin(states[20], log), "g1", "a", 0);
        if (!res.ok) throw new Error(res.error);
        const versions = res.payload.frames.map((f) => f.version);
        expect(versions.at(-1)).toBe(19);
        expect(versions.length).toBeLessThanOrEqual(8);
    });

    it("falls back to the head alone when the log has a hole", async () => {
        const { states, log } = play(5);
        const holed = log.filter((r) => r.seq !== 3);
        const res = await getGameSync(
            fakeAdmin(states[5], holed),
            "g1",
            "a",
            1,
        );
        if (!res.ok) throw new Error(res.error);
        expect(res.payload.frames).toEqual([]);
        expect(res.payload.version).toBe(5);
    });
});
