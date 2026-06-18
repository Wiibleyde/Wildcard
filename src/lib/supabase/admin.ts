import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerSupabaseEnv, getServiceRoleKey } from "./env";
import type { Database } from "./types";

/**
 * Service-role Supabase client — **server-only**, bypasses RLS.
 *
 * The game engine is server-authoritative: full secret state (every hand, the
 * RNG seed) lives in `game_states`, a table no client key can read. Only this
 * admin client touches it. Never import this from a `"use client"` module.
 *
 * No cookies / session: it authenticates purely with the service-role key, so
 * it must never be exposed to the browser. Identity checks (is this user
 * allowed to act?) are enforced in the API route before calling into it.
 */
export function createAdminClient() {
    const { url } = getServerSupabaseEnv();
    const serviceRoleKey = getServiceRoleKey();
    return createSupabaseClient<Database>(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
