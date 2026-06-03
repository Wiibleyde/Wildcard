"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "./types";

export function createClient() {
    const { url, anonKey } = getSupabaseEnv();
    return createBrowserClient<Database>(url, anonKey);
}
