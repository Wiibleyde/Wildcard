import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * RLS — database defense in depth (« un joueur ≠ main adverse »).
 *
 * The engine's `view()` already redacts opponent hands in code. This suite
 * proves the layer *underneath* it: even a client that bypasses the API routes
 * and talks straight to PostgREST cannot read another player's hand, because
 * the secret state lives in `game_states`, a table with RLS enabled and **zero
 * policies → deny-all to every client key**. Only the service role (which
 * bypasses RLS) reads it. See `supabase/migrations/20260606120000_games.sql`.
 *
 * Integration test: it needs a live Supabase stack. It is **skipped** unless
 * SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are set, so the
 * default `vitest run` (and CI) stays a pure unit run. To run it locally:
 *
 *   supabase start            # or `bun run up`
 *   bun run db:migrate
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     bunx vitest run src/lib/supabase/rls.integration.test.ts
 */

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIGURED = Boolean(url && anonKey && serviceKey);

const clientOpts = {
    auth: { autoRefreshToken: false, persistSession: false },
} as const;

/** Unique per run so a crashed run never blocks the next one on a leftover row. */
const STAMP = Date.now();

describe.skipIf(!CONFIGURED)(
    "RLS: secret game state is unreadable by clients",
    () => {
        // Non-null within this block — the skipIf guard proves CONFIGURED above.
        const SUPABASE_URL = url as string;
        const ANON_KEY = anonKey as string;
        const SERVICE_KEY = serviceKey as string;

        // biome-ignore lint/suspicious/noExplicitAny: PostgREST rows are untyped here (no generated Database type imported for a raw test client).
        let admin: SupabaseClient<any>;
        // biome-ignore lint/suspicious/noExplicitAny: same — anonymous key, no session.
        let anon: SupabaseClient<any>;
        // biome-ignore lint/suspicious/noExplicitAny: same — signed-in as `player`.
        let player: SupabaseClient<any>;

        let playerId = "";
        let opponentId = "";
        let roomId = "";
        let gameId = "";

        // The secret hand we plant for the opponent — it must never reach `player`.
        const OPPONENT_SECRET_HAND = [
            { type: "suited", suit: "spades", rank: "A" },
            { type: "suited", suit: "hearts", rank: "K" },
        ];

        beforeAll(async () => {
            admin = createClient(SUPABASE_URL, SERVICE_KEY, clientOpts);
            anon = createClient(SUPABASE_URL, ANON_KEY, clientOpts);

            // Two players. Sign-up trigger `on_auth_user_created` auto-creates the
            // matching `profiles` row, so `host_id` FKs resolve.
            const email = (n: number) => `rls-test-${STAMP}-${n}@example.test`;
            const password = "rls-test-password-123!";

            const p1 = await admin.auth.admin.createUser({
                email: email(1),
                password,
                email_confirm: true,
            });
            if (p1.error) throw p1.error;
            playerId = p1.data.user.id;

            const p2 = await admin.auth.admin.createUser({
                email: email(2),
                password,
                email_confirm: true,
            });
            if (p2.error) throw p2.error;
            opponentId = p2.data.user.id;

            // Seed a room → game → secret state, all via the service role.
            const room = await admin
                .from("rooms")
                .insert({
                    code: `RLS${STAMP}`,
                    module_id: "president",
                    host_id: playerId,
                })
                .select("id")
                .single();
            if (room.error) throw room.error;
            roomId = room.data.id;

            await admin.from("room_players").insert([
                { room_id: roomId, user_id: playerId, seat: 0 },
                { room_id: roomId, user_id: opponentId, seat: 1 },
            ]);

            const game = await admin
                .from("games")
                .insert({
                    room_id: roomId,
                    module_id: "president",
                    phase: "playing",
                    current_player_id: playerId,
                })
                .select("id")
                .single();
            if (game.error) throw game.error;
            gameId = game.data.id;

            const state = await admin.from("game_states").insert({
                game_id: gameId,
                state: {
                    gameId,
                    seed: 424242,
                    phase: "playing",
                    hands: {
                        [playerId]: [
                            { type: "suited", suit: "clubs", rank: "3" },
                        ],
                        [opponentId]: OPPONENT_SECRET_HAND,
                    },
                },
            });
            if (state.error) throw state.error;

            // Sign the first player in with a real session (JWT `authenticated` role).
            player = createClient(SUPABASE_URL, ANON_KEY, clientOpts);
            const signIn = await player.auth.signInWithPassword({
                email: email(1),
                password,
            });
            if (signIn.error) throw signIn.error;
        });

        afterAll(async () => {
            if (!admin) return;
            // Deleting the room cascades to games → game_states → room_players.
            if (roomId) await admin.from("rooms").delete().eq("id", roomId);
            if (playerId) await admin.auth.admin.deleteUser(playerId);
            if (opponentId) await admin.auth.admin.deleteUser(opponentId);
        });

        it("lets the service role read the secret state (the server is authoritative)", async () => {
            const { data, error } = await admin
                .from("game_states")
                .select("*")
                .eq("game_id", gameId);
            expect(error).toBeNull();
            expect(data ?? []).toHaveLength(1);
        });

        it("denies an authenticated player the secret state — the opponent's hand never leaks", async () => {
            const { data, error } = await player
                .from("game_states")
                .select("*")
                .eq("game_id", gameId);

            // RLS deny-all surfaces as an empty result set, not an error.
            expect(error).toBeNull();
            expect(data ?? []).toHaveLength(0);
            // Belt and suspenders: nothing from the secret row (which is keyed
            // by the opponent's id and holds their hand) reached this client.
            expect(JSON.stringify(data ?? [])).not.toContain(opponentId);
        });

        it("denies the anonymous key the secret state too", async () => {
            const { data } = await anon
                .from("game_states")
                .select("*")
                .eq("game_id", gameId);
            expect(data ?? []).toHaveLength(0);
        });

        it("still exposes the PUBLIC game meta to the authenticated player", async () => {
            const { data, error } = await player
                .from("games")
                .select("id, phase, current_player_id")
                .eq("id", gameId);
            expect(error).toBeNull();
            expect(data ?? []).toHaveLength(1);
            expect(data?.[0].phase).toBe("playing");
        });

        it("hides even the public meta from the anonymous (unauthenticated) key", async () => {
            const { data } = await anon
                .from("games")
                .select("*")
                .eq("id", gameId);
            expect(data ?? []).toHaveLength(0);
        });

        it("refuses a client write to public game meta (server-authoritative)", async () => {
            await player
                .from("games")
                .update({ phase: "finished" })
                .eq("id", gameId);

            // RLS filters the UPDATE to zero rows; re-read with the service role.
            const { data } = await admin
                .from("games")
                .select("phase")
                .eq("id", gameId)
                .single();
            expect(data?.phase).toBe("playing"); // unchanged
        });

        it("refuses a client write to the secret state", async () => {
            const { error } = await player.from("game_states").insert({
                game_id: gameId,
                state: { forged: true },
            });
            expect(error).not.toBeNull(); // RLS rejects the insert
        });
    },
);
