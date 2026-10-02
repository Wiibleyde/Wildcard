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
 * Docker network instead (`http://supabase-kong:8000`). It falls back to the public URL
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
 * Schema every query targets. Typed as the literal of the generated `Database`
 * so `wildcard_dev` (same structure, dev twin on the shared stack) still type-
 * checks. Defaults to `wildcard`.
 */
export function getSupabaseSchema(): "wildcard" {
    return (publicEnv().SUPABASE_SCHEMA || "wildcard") as "wildcard";
}

/**
 * Options shared by the browser, server and proxy clients so they agree on the
 * session cookie the portal (auth.wiibleyde.dev) writes for the whole domain:
 *
 * - `name` — pinned to the public-URL host (see {@link getSupabaseStorageKey}),
 *   `sb-supabase-auth-token` in prod, the same name the portal uses.
 * - `cookieEncoding: "raw"` — the portal stores the session as plain URL-encoded
 *   JSON and parses it as such. The default (`base64-…`) would make the first
 *   token refresh here rewrite the cookie in a format the portal cannot read,
 *   breaking the session on every *.wiibleyde.dev app at once.
 * - `domain` — `.wiibleyde.dev` in prod so the refreshed cookie replaces the
 *   portal's one; unset on localhost (the browser would drop it).
 * - `detectSessionInUrl: false` — the portal owns the OAuth/magic-link
 *   callback; this app must never try to consume a `?code=` / `#access_token`
 *   that happens to be in one of its URLs.
 */
export function supabaseSharedOptions() {
    const { COOKIE_DOMAIN: domain } = publicEnv();
    return {
        db: { schema: getSupabaseSchema() },
        auth: { detectSessionInUrl: false },
        cookieEncoding: "raw" as const,
        cookieOptions: {
            name: getSupabaseStorageKey(),
            path: "/",
            sameSite: "lax" as const,
            ...(domain ? { domain, secure: true } : {}),
        },
    };
}

/**
 * Returns the server-only secret key (`sb_secret_…`, service role), throwing
 * early if missing.
 *
 * This key bypasses RLS and must never reach the browser — it is read only
 * from server code (API routes / server models) via {@link createAdminClient}.
 */
export function getServiceRoleKey(): string {
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key) {
        throw new Error(
            "SUPABASE_SECRET_KEY must be set (server-only — see .env.local)",
        );
    }
    return key;
}
