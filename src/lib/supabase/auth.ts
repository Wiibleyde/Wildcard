"use client";

import type { Provider } from "@supabase/supabase-js";
import { createClient } from "./client";

export type OAuthProvider = Extract<Provider, "google" | "discord" | "apple">;

export async function signInWithOAuth(
    provider: OAuthProvider,
    locale: string = "fr",
) {
    const supabase = createClient();
    return supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/${locale}`,
        },
    });
}

export async function linkIdentity(
    provider: OAuthProvider,
    locale: string = "fr",
) {
    const supabase = createClient();
    return supabase.auth.linkIdentity({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/profile`,
        },
    });
}

export async function signOut() {
    const supabase = createClient();
    return supabase.auth.signOut();
}
