import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerSupabaseEnv, getSupabaseStorageKey } from "./env";
import type { Database } from "./types";

export async function createClient() {
    const cookieStore = await cookies();
    const { url, anonKey } = getServerSupabaseEnv();

    return createServerClient<Database>(url, anonKey, {
        // Pin the cookie name to the public-URL host so it matches the browser
        // client (server talks to `kong`, browser to `localhost`) — see
        // getSupabaseStorageKey.
        cookieOptions: { name: getSupabaseStorageKey() },
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
