/**
 * Runtime public config. `NEXT_PUBLIC_*` would be frozen into the one CI-built
 * image, so these plain keys are read from `process.env` per request and
 * shipped to the browser as `window.__PUBLIC_ENV__`. Public-safe values only:
 * never the service-role key.
 */
export interface PublicEnv {
    readonly SUPABASE_URL: string;
    readonly SUPABASE_ANON_KEY: string;
    /** `wildcard` (prod) or `wildcard_dev`. */
    readonly SUPABASE_SCHEMA: string;
    /** `.wiibleyde.dev`; empty on localhost. */
    readonly COOKIE_DOMAIN: string;
    readonly APP_URL: string;
    /** Empty for local dev. */
    readonly PORTAL_URL: string;
    readonly UMAMI_URL: string;
    readonly UMAMI_WEBSITE_ID: string;
}

declare global {
    interface Window {
        __PUBLIC_ENV__?: PublicEnv;
    }
}

/** Server only. */
export function readPublicEnvFromProcess(): PublicEnv {
    return {
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
        SUPABASE_SCHEMA: process.env.SUPABASE_SCHEMA ?? "",
        COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? "",
        APP_URL: process.env.APP_URL ?? "",
        PORTAL_URL: process.env.PORTAL_URL ?? "",
        UMAMI_URL: process.env.UMAMI_URL ?? "",
        UMAMI_WEBSITE_ID: process.env.UMAMI_WEBSITE_ID ?? "",
    };
}

const EMPTY_PUBLIC_ENV: PublicEnv = {
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    SUPABASE_SCHEMA: "",
    COOKIE_DOMAIN: "",
    APP_URL: "",
    PORTAL_URL: "",
    UMAMI_URL: "",
    UMAMI_WEBSITE_ID: "",
};

export function publicEnv(): PublicEnv {
    if (typeof window !== "undefined") {
        return window.__PUBLIC_ENV__ ?? EMPTY_PUBLIC_ENV;
    }
    return readPublicEnvFromProcess();
}
