import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/bearer";
import { type AppRole, getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/models/settings";
import type { Database } from "@/lib/supabase/types";

/** The caller and an RLS client acting with their bearer token. */
export type AuthedRoute = {
    readonly ok: true;
    readonly user: AuthUser;
    readonly supabase: SupabaseClient<Database>;
};

type Denied = { readonly ok: false; readonly response: NextResponse };

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function deny(
    error: string,
    status: number,
    headers?: Record<string, string>,
): Denied {
    return {
        ok: false,
        response: NextResponse.json({ error }, { status, headers }),
    };
}

async function authenticate(
    request: Request,
    min: AppRole | null,
): Promise<(AuthedRoute & { readonly role: AppRole | null }) | Denied> {
    // Bearer only, never the cookie: it rides along on any same-site request (CSRF).
    const verified = await verifyBearer(request);
    if (!verified.ok) {
        return deny(verified.error, 401, { "WWW-Authenticate": "Bearer" });
    }
    const { user, supabase } = verified;

    let role: AppRole | null = null;
    const roleOf = async () => {
        role ??= await getUserRole(supabase, user.id);
        return role;
    };

    // The proxy's maintenance gate skips /api, so mutations are gated here.
    if (!READ_METHODS.has(request.method.toUpperCase())) {
        const settings = await getAppSettings(supabase);
        if (settings.maintenance && !roleAtLeast(await roleOf(), "admin")) {
            return deny("maintenance", 503, { "Retry-After": "300" });
        }
    }
    if (min !== null && !roleAtLeast(await roleOf(), min)) {
        return deny("forbidden", 403);
    }
    return { ok: true, user, supabase, role };
}

/** 401 with the portal's code (`unauthorized`, `token_expired`, `session_revoked`), 503 in maintenance. */
export async function requireUser(
    request: Request,
): Promise<AuthedRoute | Denied> {
    return authenticate(request, null);
}

/** {@link requireUser} plus a minimum global role (403 `forbidden`). */
export async function requireRole(
    request: Request,
    min: AppRole,
): Promise<(AuthedRoute & { readonly role: AppRole }) | Denied> {
    const auth = await authenticate(request, min);
    if (!auth.ok) return auth;
    return { ...auth, role: auth.role ?? min };
}
