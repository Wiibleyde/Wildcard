"use client";

import { loginUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/client";

/**
 * `fetch` for the app's own `/api` routes — and, through {@link portalFetch},
 * for the portal's — authenticated by the shared session's **access token**,
 * sent as `Authorization: Bearer`. The API ignores the session cookie on
 * purpose: the cookie rides along on any same-site request, a header does not
 * (see `@/lib/auth/bearer`).
 *
 * The token is only ever sent to this app's own origin and to the portal — never
 * to a third party, never in a URL.
 *
 * 401 handling follows the portal's contract:
 * - `token_expired` → refresh the session once and retry the call;
 * - `session_revoked` → the session was ended elsewhere (logout, password
 *   reset): send the user to sign in again.
 */

/** The current access token, refreshed by supabase-js when close to expiry. */
async function accessToken(forceRefresh = false): Promise<string | null> {
    const supabase = createClient();
    if (forceRefresh) {
        const { data } = await supabase.auth.refreshSession();
        return data.session?.access_token ?? null;
    }
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}

function withBearer(init: RequestInit, token: string | null): RequestInit {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return { ...init, headers };
}

/** Peek at a 401 body's `error` code without consuming the original response. */
async function errorCode(res: Response): Promise<string | null> {
    try {
        const body = (await res.clone().json()) as { error?: unknown };
        return typeof body.error === "string" ? body.error : null;
    } catch {
        return null;
    }
}

/** Send the user to the portal sign-in, coming back to the current page. */
function redirectToSignIn(): void {
    const { pathname, search } = window.location;
    const lang = pathname.split("/")[1] || "fr";
    window.location.assign(loginUrl(`${pathname}${search}`, lang));
}

async function authedFetch(
    input: string,
    init: RequestInit = {},
): Promise<Response> {
    const res = await fetch(input, withBearer(init, await accessToken()));
    if (res.status !== 401) return res;

    const code = await errorCode(res);
    if (code === "token_expired") {
        const fresh = await accessToken(true);
        if (fresh) {
            const retry = await fetch(input, withBearer(init, fresh));
            if (retry.status !== 401) return retry;
            if ((await errorCode(retry)) === "session_revoked") {
                redirectToSignIn();
            }
            return retry;
        }
    }
    if (code === "session_revoked") redirectToSignIn();
    return res;
}

/**
 * Call one of the app's API routes (`/api/...`). Drop-in for `fetch`: same
 * arguments, same `Response`.
 */
export function apiFetch(
    path: `/api/${string}`,
    init?: RequestInit,
): Promise<Response> {
    return authedFetch(path, init);
}

/** Same as {@link apiFetch}, for an absolute portal URL (`/api/v1/...`). */
export function portalFetch(
    url: string,
    init?: RequestInit,
): Promise<Response> {
    return authedFetch(url, { ...init, credentials: "omit" });
}
