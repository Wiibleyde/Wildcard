/**
 * Runtime public configuration.
 *
 * The problem: `NEXT_PUBLIC_*` vars are **inlined at build time**. A single
 * image built once by CI (GitHub Actions) would freeze whatever values were
 * present at build — useless when the same image must run in dev / staging /
 * prod with different Supabase or Umami URLs.
 *
 * The fix: these values are **not** `NEXT_PUBLIC_*` and are never read by the
 * client bundle directly. Instead the server reads `process.env` at request
 * time and ships them to the browser as `window.__PUBLIC_ENV__` (see
 * {@link PublicEnvScript}). One image, configured at container start.
 *
 * Only public-safe values live here (anon key + public URLs). The service-role
 * key is server-only and must never appear in this object — see
 * `src/lib/supabase/env.ts`.
 */

export interface PublicEnv {
    readonly SUPABASE_URL: string;
    readonly SUPABASE_ANON_KEY: string;
    readonly UMAMI_URL: string;
    readonly UMAMI_WEBSITE_ID: string;
}

declare global {
    interface Window {
        __PUBLIC_ENV__?: PublicEnv;
    }
}

/**
 * Read the public env from `process.env` at runtime (server only). Plain,
 * non-prefixed keys → Next does not inline them, so they reflect the live
 * container environment, not the build.
 */
export function readPublicEnvFromProcess(): PublicEnv {
    return {
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
        UMAMI_URL: process.env.UMAMI_URL ?? "",
        UMAMI_WEBSITE_ID: process.env.UMAMI_WEBSITE_ID ?? "",
    };
}

/**
 * Isomorphic accessor. In the browser it reads the injected
 * `window.__PUBLIC_ENV__`; on the server it reads live `process.env`.
 */
export function publicEnv(): PublicEnv {
    if (typeof window !== "undefined") {
        return (
            window.__PUBLIC_ENV__ ?? {
                SUPABASE_URL: "",
                SUPABASE_ANON_KEY: "",
                UMAMI_URL: "",
                UMAMI_WEBSITE_ID: "",
            }
        );
    }
    return readPublicEnvFromProcess();
}
