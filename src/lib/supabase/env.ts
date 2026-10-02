import { publicEnv } from "@/lib/public-env";

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
 * URL for code running inside the container: the public URL's `localhost` is
 * the container itself there, so `SUPABASE_INTERNAL_URL` points at Kong instead.
 */
export function getServerSupabaseEnv(): { url: string; anonKey: string } {
    const { url: publicUrl, anonKey } = getSupabaseEnv();
    const url = process.env.SUPABASE_INTERNAL_URL || publicUrl;
    return { url, anonKey };
}

/**
 * Pinned to the *public* host: supabase-js derives the cookie name from the
 * connection host, which differs between server (Kong) and browser.
 */
function getSupabaseStorageKey(): string {
    const { url } = getSupabaseEnv();
    const host = new URL(url).hostname.split(".")[0];
    return `sb-${host}-auth-token`;
}

/** `wildcard_dev` shares the generated `wildcard` types. */
export function getSupabaseSchema(): "wildcard" {
    return (publicEnv().SUPABASE_SCHEMA || "wildcard") as "wildcard";
}

/**
 * Must match the portal's session cookie byte for byte: `raw` encoding (the
 * default base64 rewrite would break the session on every *.wiibleyde.dev app)
 * and the shared domain. The portal owns OAuth callbacks, hence no URL detection.
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

/** Server-only service-role key. */
export function getServiceRoleKey(): string {
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key) {
        throw new Error(
            "SUPABASE_SECRET_KEY must be set (server-only — see .env.local)",
        );
    }
    return key;
}
