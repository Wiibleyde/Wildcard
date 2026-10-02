import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
    getServerSupabaseEnv,
    getSupabaseSchema,
    supabaseSharedOptions,
} from "./env";
import type { Database } from "./types";

/**
 * RLS-scoped client acting as the holder of `accessToken` — for API routes,
 * which authenticate by `Authorization: Bearer` rather than the session cookie
 * (see `@/lib/auth/bearer`). Stateless: no cookie, no refresh, no storage.
 */
export function createTokenClient(accessToken: string) {
    const { url, anonKey } = getServerSupabaseEnv();
    return createSupabaseClient<Database>(url, anonKey, {
        db: { schema: getSupabaseSchema() },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}

export async function createClient() {
    const cookieStore = await cookies();
    const { url, anonKey } = getServerSupabaseEnv();

    return createServerClient<Database>(url, anonKey, {
        // Same cookie name/encoding/domain as the browser client and the portal
        // (server talks to Kong directly, browser to the public URL) — see env.ts.
        ...supabaseSharedOptions(),
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Called from a Server Component — session refresh is handled by proxy.ts
                }
            },
        },
    });
}
