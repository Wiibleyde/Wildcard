import {
    createClient as createSupabaseClient,
    type SupabaseClient,
} from "@supabase/supabase-js";
import {
    getServerSupabaseEnv,
    getServiceRoleKey,
    getSupabaseSchema,
} from "./env";
import type { Database } from "./types";

/** Service-role client: bypasses RLS, so callers must authorize first. */
export type AdminClient = SupabaseClient<Database>;

/** Server-only — the only client allowed to read `game_states`. */
export function createAdminClient(): AdminClient {
    const { url } = getServerSupabaseEnv();
    return createSupabaseClient<Database>(url, getServiceRoleKey(), {
        db: { schema: getSupabaseSchema() },
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
