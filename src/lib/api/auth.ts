import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/bearer";
import { type AppRole, getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/models/settings";
import type { Database } from "@/lib/supabase/types";

/**
 * Authenticated route context: the caller and an RLS-scoped Supabase client
 * acting with their bearer token. Routes that mutate game state create the
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
 * Identity comes **only** from the `Authorization: Bearer` header, never from
 * the session cookie (CSRF across `*.wiibleyde.dev`, see `@/lib/auth/bearer`).
 * A 401 carries the portal's error code (`unauthorized`, `token_expired`,
 * `session_revoked`) so `apiFetch` knows whether to refresh and retry.
 *
 * For a mutating method (POST/PUT/PATCH/DELETE) it also
 * enforces **maintenance mode**. The proxy's maintenance gate excludes `/api`
 * (its matcher skips it), so without this a non-admin with an open tab could
 * keep playing and creating rooms during maintenance. Reads stay open so open
 * pages degrade gracefully; admins are never locked out.
 *
 * Returning the error as a value (not throwing) keeps each handler a flat,
 * linear function with no try/catch ceremony.
 */
export async function requireUser(
    request: Request,
): Promise<AuthedRoute | Denied> {
    const verified = await verifyBearer(request);
    if (!verified.ok) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: verified.error },
                {
                    status: 401,
                    headers: { "WWW-Authenticate": "Bearer" },
                },
            ),
        };
    }
    const { user, supabase } = verified;

    if (!READ_METHODS.has(request.method.toUpperCase())) {
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
 * const auth = await requireRole(request, "moderator");
 * if (!auth.ok) return auth.response;
 * // auth.user, auth.supabase, auth.role
 * ```
 */
export async function requireRole(
    request: Request,
    min: AppRole,
): Promise<(AuthedRoute & { readonly role: AppRole }) | Denied> {
    const auth = await requireUser(request);
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
