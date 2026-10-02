import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createTokenClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Bearer-token authentication for the API routes (portal integration, mode C).
 *
 * Why not the session cookie: the portal's cookie lives on `.wiibleyde.dev`,
 * and every subdomain is *same-site* — `SameSite=Lax` does not stop a page on
 * a sibling app from making the browser ride it into a state-changing request.
 * An `Authorization` header is something the caller must set itself, so a
 * cross-origin page cannot forge it (CORS forbids it without a preflight this
 * app never grants). The front end reads the token from the shared session and
 * sends it on every call (see `@/lib/api/client`).
 *
 * Error codes mirror the portal's `/api/v1` so one client handles both:
 * `unauthorized`, `token_expired` (refresh and retry once), `session_revoked`
 * (signed out elsewhere — send the user to sign in).
 */
export type BearerError = "unauthorized" | "token_expired" | "session_revoked";

export type BearerResult =
    | {
          readonly ok: true;
          readonly user: AuthUser;
          /** RLS-scoped client acting as the token's user. */
          readonly supabase: SupabaseClient<Database>;
      }
    | { readonly ok: false; readonly error: BearerError };

/** How long a "session still alive" answer from GoTrue is trusted — as the portal. */
const LIVENESS_TTL_MS = 15_000;
/** Bound on the cache: a burst of distinct sessions must not grow it forever. */
const LIVENESS_MAX_ENTRIES = 5_000;

/** `session_id` → time the session was last confirmed alive. */
const aliveSessions = new Map<string, number>();

/** The raw token of an `Authorization: Bearer <token>` header, if any. */
export function bearerToken(request: Request): string | null {
    const header = request.headers.get("authorization");
    if (!header) return null;
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : null;
}

/**
 * Accepted `iss` values. GoTrue signs with its external URL, which on the
 * shared infra is the bare `https://supabase.wiibleyde.dev` and on the local
 * CLI stack `<url>/auth/v1` — both derived from the public Supabase URL.
 */
function acceptedIssuers(): readonly string[] {
    const base = getSupabaseEnv().url.replace(/\/$/, "");
    return [base, `${base}/auth/v1`];
}

function hasAudience(aud: unknown, expected: string): boolean {
    return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

/**
 * Is the session behind this token still alive? A logout, a password reset or
 * an operator deleting the session leaves already-issued tokens validly
 * *signed* until `exp` (up to an hour); only GoTrue knows the session is gone
 * (`GET /auth/v1/user` answers 401/403). The answer is cached per `session_id`
 * for {@link LIVENESS_TTL_MS}, so a revoked session is refused within 15 s.
 *
 * Fails **open** when GoTrue is unreachable or erroring (5xx): the signature
 * was verified, and an auth outage must not lock every player out mid-game.
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
        // 401/403/404: the session (or the user) no longer exists.
        if (status >= 400 && status < 500) {
            if (sessionId) aliveSessions.delete(sessionId);
            return false;
        }
        // Network error / 5xx — fail open on the verified signature.
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

/**
 * Verify the request's bearer token: signature against the instance JWKS
 * (`getClaims`), issuer, `authenticated` audience, expiry, then liveness.
 */
export async function verifyBearer(request: Request): Promise<BearerResult> {
    const token = bearerToken(request);
    if (!token) return { ok: false, error: "unauthorized" };

    const supabase = createTokenClient(token);
    // `allowExpired`: verify the signature first, then tell an expired token
    // (the client refreshes and retries) apart from a forged one.
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
