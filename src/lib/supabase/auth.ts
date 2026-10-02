"use client";

import { createClient } from "./client";

/** Ends the portal's domain-wide session, i.e. on every *.wiibleyde.dev app. */
export async function signOut() {
    return createClient().auth.signOut();
}
