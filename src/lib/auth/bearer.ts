import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createTokenClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * API identity comes from `Authorization: Bearer` only. The portal cookie is
 * shared by every same-site *.wiibleyde.dev app, so `SameSite=Lax` cannot stop
 * a sibling page from riding it; a header must be set by the caller itself.
 * Error codes mirror the portal's `/api/v1`.
 */
export type BearerError = "unauthorized" | "token_expired" | "session_revoked";

export type BearerResult =
    | {
          readonly ok: true;
          readonly user: AuthUser;
          /** RLS client acting as the token's user. */
          readonly supabase: SupabaseClient<Database>;
      }
    | { readonly ok: false; readonly error: BearerError };

/** Same TTL as the portal: a revoked session is refused within 15 s. */
const LIVENESS_TTL_MS = 15_000;
const LIVENESS_MAX_ENTRIES = 5_000;

/** `session_id` → when the session was last confirmed alive. */
const aliveSessions = new Map<string, number>();

export function bearerToken(request: Request): string | null {
    const header = request.headers.get("authorization");
    if (!header) return null;
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : null;
}

/** GoTrue signs with its external URL: bare on the shared infra, `/auth/v1` on the CLI stack. */
function acceptedIssuers(): readonly string[] {
    const base = getSupabaseEnv().url.replace(/\/$/, "");
    return [base, `${base}/auth/v1`];
}

function hasAudience(aud: unknown, expected: string): boolean {
    return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

/**
 * A signed token outlives a logout until `exp`; only GoTrue knows the session
 * is gone. Fails open on GoTrue 5xx/network errors (signature already verified)
 * so an auth outage does not lock players out mid-game.
 */
async function sessionAlive(
    supabase: SupabaseClient<Database>,
    token: string,
    sessionId: string | null,
): Promise<boolean> {
    const now = Date.now();
    if (sessionId) {
        const seen = aliveSessions.get(sessionId);
        if (seen !== undefined && now - seen < LIVENESS_TTL_MS) return true;
    }

    const { error } = await supabase.auth.getUser(token);
    if (error) {
        const status = error.status ?? 0;
        if (status >= 400 && status < 500) {
            if (sessionId) aliveSessions.delete(sessionId);
            return false;
        }
        return true;
    }

    if (sessionId) {
        if (aliveSessions.size >= LIVENESS_MAX_ENTRIES) {
            for (const [id, at] of aliveSessions) {
                if (now - at >= LIVENESS_TTL_MS) aliveSessions.delete(id);
            }
            if (aliveSessions.size >= LIVENESS_MAX_ENTRIES)
                aliveSessions.clear();
        }
        aliveSessions.set(sessionId, now);
    }
    return true;
}

/** Signature (instance JWKS), issuer, `authenticated` audience, expiry, liveness. */
export async function verifyBearer(request: Request): Promise<BearerResult> {
    const token = bearerToken(request);
    if (!token) return { ok: false, error: "unauthorized" };

    const supabase = createTokenClient(token);
    // `allowExpired`: verify the signature first, then tell expired from forged.
    const { data, error } = await supabase.auth.getClaims(token, {
        allowExpired: true,
    });
    const claims = data?.claims;
    if (error || !claims?.sub) return { ok: false, error: "unauthorized" };

    if (
        !acceptedIssuers().includes(String(claims.iss)) ||
        !hasAudience(claims.aud, "authenticated")
    ) {
        return { ok: false, error: "unauthorized" };
    }
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
        return { ok: false, error: "token_expired" };
    }

    const sessionId =
        typeof claims.session_id === "string" ? claims.session_id : null;
    if (!(await sessionAlive(supabase, token, sessionId))) {
        return { ok: false, error: "session_revoked" };
    }

    return {
        ok: true,
        user: {
            id: claims.sub,
            email: typeof claims.email === "string" ? claims.email : null,
        },
        supabase,
    };
}
