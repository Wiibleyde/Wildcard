import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
    getServerSupabaseEnv,
    getSupabaseSchema,
    supabaseSharedOptions,
} from "./env";
import type { Database } from "./types";

/** Stateless RLS client acting as the bearer token's user (API routes). */
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

/** Cookie-session RLS client for Server Components. */
export async function createClient() {
    const cookieStore = await cookies();
    const { url, anonKey } = getServerSupabaseEnv();

    return createServerClient<Database>(url, anonKey, {
        ...supabaseSharedOptions(),
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Server Components cannot write cookies; proxy.ts refreshes the session.
                }
            },
        },
    });
}
