"use client";

import { loginUrl } from "@/lib/auth/urls";
import { localeFromPath } from "@/lib/locale";
import { createClient } from "@/lib/supabase/client";

// The access token goes only to this origin and the portal, as a header:
// unlike the shared cookie, a sibling site cannot make the browser send it.

async function accessToken(forceRefresh = false): Promise<string | null> {
    const supabase = createClient();
    const { data } = forceRefresh
        ? await supabase.auth.refreshSession()
        : await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}

function withBearer(init: RequestInit, token: string | null): RequestInit {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return { ...init, headers };
}

/** The JSON body, or `null` when it is not JSON (a 5xx/proxy page). Consumes `res`. */
export async function readApiJson<T>(res: Response): Promise<T | null> {
    try {
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

/** The `error` code of an API response body, if any. Consumes `res`. */
export async function readApiError(res: Response): Promise<string | null> {
    const body = await readApiJson<{ error?: unknown }>(res);
    return typeof body?.error === "string" ? body.error : null;
}

function redirectToSignIn(): void {
    const { pathname, search } = window.location;
    window.location.assign(
        loginUrl(`${pathname}${search}`, localeFromPath(pathname)),
    );
}

/** 401 contract (portal's): `token_expired` → refresh once and retry; `session_revoked` → sign in. */
async function authedFetch(
    input: string,
    init: RequestInit = {},
): Promise<Response> {
    const res = await fetch(input, withBearer(init, await accessToken()));
    if (res.status !== 401) return res;

    const code = await readApiError(res.clone());
    if (code === "token_expired") {
        const fresh = await accessToken(true);
        if (!fresh) {
            redirectToSignIn();
            return res;
        }
        const retry = await fetch(input, withBearer(init, fresh));
        if (
            retry.status === 401 &&
            (await readApiError(retry.clone())) === "session_revoked"
        ) {
            redirectToSignIn();
        }
        return retry;
    }
    if (code === "session_revoked") redirectToSignIn();
    return res;
}

/** Drop-in `fetch` for the app's own API routes. */
export function apiFetch(
    path: `/api/${string}`,
    init?: RequestInit,
): Promise<Response> {
    return authedFetch(path, init);
}

/** {@link apiFetch} for an absolute portal API URL. */
export function portalFetch(
    url: string,
    init?: RequestInit,
): Promise<Response> {
    return authedFetch(url, { ...init, credentials: "omit" });
}
