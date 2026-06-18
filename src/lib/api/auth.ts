import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Authenticated route context: the signed-in user and their RLS-scoped
 * (cookie-session) Supabase client. Routes that mutate game state create the
 * service-role admin client themselves ({@link createAdminClient}) after the
 * identity check; routes that only touch the caller's own rows use `supabase`.
 */
export type AuthedRoute = {
    readonly ok: true;
    readonly user: User;
    readonly supabase: SupabaseClient<Database>;
};

/**
 * Resolve the authenticated user, or a 401 response, for an API route. Replaces
 * the `createClient → auth.getUser → 401` block that every route handler
 * repeated verbatim:
 *
 * ```ts
 * const auth = await requireUser();
 * if (!auth.ok) return auth.response;
 * // auth.user, auth.supabase
 * ```
 *
 * Returning the 401 as a value (not throwing) keeps each handler a flat,
 * linear function with no try/catch ceremony.
 */
export async function requireUser(): Promise<
    AuthedRoute | { readonly ok: false; readonly response: NextResponse }
> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            ),
        };
    }
    return { ok: true, user, supabase };
}
