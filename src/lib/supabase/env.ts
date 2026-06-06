/**
 * Returns the required Supabase env vars, throwing early with a clear message
 * if either is missing — better than a cryptic runtime failure downstream.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
        );
    }
    return { url, anonKey };
}

/**
 * Returns the server-only service-role key, throwing early if missing.
 *
 * This key bypasses RLS and must never reach the browser — it is read only
 * from server code (API routes / server models) via {@link createAdminClient}.
 */
export function getServiceRoleKey(): string {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY must be set (server-only — see .env.local)",
        );
    }
    return key;
}
