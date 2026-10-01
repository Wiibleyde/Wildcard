"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, supabaseSharedOptions } from "./env";
import type { Database } from "./types";

export function createClient() {
    const { url, anonKey } = getSupabaseEnv();
    // Shared options: schema, raw cookie encoding and domain — the session
    // cookie is the portal's, shared across *.wiibleyde.dev (see env.ts).
    return createBrowserClient<Database>(url, anonKey, supabaseSharedOptions());
}
