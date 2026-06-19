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
 * Server-side Supabase base URL — for code that runs **inside** the container
 * (SSR, route handlers, the proxy, the service-role admin client).
 *
 * The public {@link getSupabaseEnv} URL (e.g. `http://localhost:54321`) is the
 * browser's view: `localhost` is the host that maps Kong's port. Inside the app
 * container `localhost` is the container itself, so that URL is unreachable
 * ("ConnectionRefused"). `SUPABASE_INTERNAL_URL` points at the gateway on the
 * compose network instead (`http://kong:8000`). It falls back to the public URL
 * for local `next dev`, where `localhost` really is the host running Supabase.
 */
export function getServerSupabaseEnv(): { url: string; anonKey: string } {
    const { url: publicUrl, anonKey } = getSupabaseEnv();
    const url = process.env.SUPABASE_INTERNAL_URL || publicUrl;
    return { url, anonKey };
}

/**
 * Auth cookie / storage key — must be **byte-identical** across the browser and
 * every server client. supabase-js derives it from the connection URL host
 * (`sb-<host>-auth-token`); but the server reaches Supabase through a different
 * host than the browser (`kong` vs `localhost`, see {@link getServerSupabaseEnv}),
 * so the defaults would diverge and the PKCE verifier + session would be written
 * under one name and read under another — login silently fails. We pin it to the
 * **public** URL host everywhere via `cookieOptions.name`, so dev resolves to
 * `sb-localhost-auth-token` and prod to `sb-<ref>-auth-token` on both sides.
 */
export function getSupabaseStorageKey(): string {
    const { url } = getSupabaseEnv();
    const host = new URL(url).hostname.split(".")[0];
    return `sb-${host}-auth-token`;
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
