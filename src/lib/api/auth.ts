import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { type AppRole, getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/models/settings";
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
    readonly user: AuthUser;
    readonly supabase: SupabaseClient<Database>;
};

type Denied = { readonly ok: false; readonly response: NextResponse };

/** Methods that never change state — always allowed, even in maintenance. */
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Resolve the authenticated user, or a 401 response, for an API route. Replaces
 * the `createClient → auth → 401` block that every route handler repeated
 * verbatim:
 *
 * ```ts
 * const auth = await requireUser(request);
 * if (!auth.ok) return auth.response;
 * // auth.user, auth.supabase
 * ```
 *
 * Pass the `request`: for a mutating method (POST/PUT/PATCH/DELETE) it also
 * enforces **maintenance mode**. The proxy's maintenance gate excludes `/api`
 * (its matcher skips it), so without this a non-admin with an open tab could
 * keep playing and creating rooms during maintenance. Reads stay open so open
 * pages degrade gracefully; admins are never locked out.
 *
 * Returning the error as a value (not throwing) keeps each handler a flat,
 * linear function with no try/catch ceremony.
 */
export async function requireUser(
    request?: Request,
): Promise<AuthedRoute | Denied> {
    const supabase = await createClient();
    // Verified JWT claims (see getAuthUser) — no round trip to the auth server.
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            ),
        };
    }
    const user: AuthUser = {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
    };

    if (request && !READ_METHODS.has(request.method.toUpperCase())) {
        const settings = await getAppSettings(supabase);
        if (
            settings.maintenance &&
            !roleAtLeast(await getUserRole(supabase, user.id), "admin")
        ) {
            return {
                ok: false,
                response: NextResponse.json(
                    { error: "maintenance" },
                    { status: 503, headers: { "Retry-After": "300" } },
                ),
            };
        }
    }

    return { ok: true, user, supabase };
}

/**
 * Like {@link requireUser}, but also enforces a minimum global role. Returns
 * 401 when signed out and 403 when signed in but under-privileged, so a route
 * stays a flat:
 *
 * ```ts
 * const auth = await requireRole("moderator");
 * if (!auth.ok) return auth.response;
 * // auth.user, auth.supabase, auth.role
 * ```
 */
export async function requireRole(
    min: AppRole,
): Promise<(AuthedRoute & { readonly role: AppRole }) | Denied> {
    const auth = await requireUser();
    if (!auth.ok) return auth;

    const role = await getUserRole(auth.supabase, auth.user.id);
    if (!roleAtLeast(role, min)) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
            ),
        };
    }
    return { ...auth, role };
}
