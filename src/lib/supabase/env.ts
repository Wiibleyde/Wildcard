import { publicEnv } from "@/lib/public-env";

/**
 * Returns the required Supabase config, throwing early with a clear message if
 * either is missing — better than a cryptic runtime failure downstream.
 *
 * Sourced from the runtime public env ({@link publicEnv}), not `NEXT_PUBLIC_*`,
 * so a single CI-built image is configured at container start, not at build.
 * Works isomorphically: live `process.env` on the server, the injected
 * `window.__PUBLIC_ENV__` in the browser.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
    const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = publicEnv();
    if (!url || !anonKey) {
        throw new Error(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set (runtime env)",
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
