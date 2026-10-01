"use client";

import { createClient } from "./client";

/**
 * Sign out of the shared session. The cookie is the portal's, scoped to the
 * whole `.wiibleyde.dev` domain: this ends the session on every app of the
 * infra, not only Wildcard — the same single sign-on, in reverse.
 */
export async function signOut() {
    const supabase = createClient();
    return supabase.auth.signOut();
}
