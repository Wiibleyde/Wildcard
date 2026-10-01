import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerSupabaseEnv, supabaseSharedOptions } from "./env";
import type { Database } from "./types";

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
