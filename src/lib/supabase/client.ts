"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, getSupabaseStorageKey } from "./env";
import type { Database } from "./types";

export function createClient() {
    const { url, anonKey } = getSupabaseEnv();
    // Explicit cookie name so it never diverges from the server clients, which
    // reach Supabase via a different host (see getSupabaseStorageKey).
    return createBrowserClient<Database>(url, anonKey, {
        cookieOptions: { name: getSupabaseStorageKey() },
    });
}
