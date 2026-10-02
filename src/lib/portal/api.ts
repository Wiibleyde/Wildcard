"use client";

import { portalFetch } from "@/lib/api/client";
import { portalApiUrl } from "@/lib/auth/urls";

/**
 * Typed client for the portal's JSON API (`https://auth.wiibleyde.dev/api/v1`):
 * the account's profile and its friend / block lists, which belong to the
 * domain-wide account, not to Wildcard.
 *
 * Why the API rather than PostgREST on the `portal` schema: it is the contract
 * the portal keeps stable (the table layout is not), it merges both friend
 * edges into one `added`/`addedMe` entry, and it validates input with the same
 * rate limits as the portal's own pages. RLS still decides: the portal calls
 * Supabase with the user's own token, never a service key.
 */

/** The signed-in account (`GET /me`). */
export interface PortalMe {
    readonly id: string;
    readonly pseudo: string | null;
    readonly avatarUrl: string | null;
}

/**
 * One entry of the **directed** friend list. `added`: I added them;
 * `addedMe`: they added me. A real friendship is `mutual` (both).
 */
export interface PortalFriend {
    readonly id: string;
    readonly pseudo: string | null;
    readonly avatarUrl: string | null;
    readonly added: boolean;
    readonly addedMe: boolean;
    readonly mutual: boolean;
}

export interface PortalBlock {
    readonly id: string;
    readonly pseudo: string | null;
    readonly avatarUrl: string | null;
}

/** Who to add or block: a stranger by exact pseudo, or someone on screen by id. */
export type PortalTarget =
    | { readonly pseudo: string }
    | { readonly id: string };

/** Stable error codes of the portal API (its `message` is French-only). */
export type PortalErrorCode =
    | "invalid_pseudo"
    | "invalid_id"
    | "bad_request"
    | "self"
    | "unauthorized"
    | "token_expired"
    | "session_revoked"
    | "not_found"
    | "route_not_found"
    | "already_friend"
    | "pseudo_taken"
    | "rate_limited"
    | "upstream"
    | "unavailable"
    | "network";

const KNOWN_CODES: ReadonlySet<string> = new Set<PortalErrorCode>([
    "invalid_pseudo",
    "invalid_id",
    "bad_request",
    "self",
    "unauthorized",
    "token_expired",
    "session_revoked",
    "not_found",
    "route_not_found",
    "already_friend",
    "pseudo_taken",
    "rate_limited",
    "upstream",
]);

export class PortalApiError extends Error {
    constructor(
        readonly code: PortalErrorCode,
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "PortalApiError";
    }
}

/** Same pseudo rule as the portal: 3–24 chars of `[A-Za-z0-9._-]`. */
export const PSEUDO_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;

async function call<T>(
    path: string,
    init: { method?: string; json?: unknown } = {},
): Promise<T | null> {
    const base = portalApiUrl();
    if (!base) {
        throw new PortalApiError("unavailable", 0, "portal not configured");
    }

    let res: Response;
    try {
        res = await portalFetch(`${base}${path}`, {
            method: init.method ?? "GET",
            ...(init.json === undefined
                ? {}
                : {
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(init.json),
                  }),
        });
    } catch {
        throw new PortalApiError("network", 0, "network error");
    }

    if (res.status === 204) return null;
    const body = (await res.json().catch(() => null)) as {
        error?: unknown;
        message?: unknown;
    } | null;
    if (!res.ok) {
        const raw = typeof body?.error === "string" ? body.error : "";
        const code = (
            KNOWN_CODES.has(raw) ? raw : "upstream"
        ) as PortalErrorCode;
        const message = typeof body?.message === "string" ? body.message : raw;
        throw new PortalApiError(code, res.status, message);
    }
    return body as T;
}

export async function getMe(): Promise<PortalMe> {
    return (await call<PortalMe>("/me")) as PortalMe;
}

/** Sorted by the portal: mutual, then waiting for them, then waiting for me. */
export async function listFriends(): Promise<readonly PortalFriend[]> {
    const body = await call<{ friends: PortalFriend[] }>("/friends");
    return body?.friends ?? [];
}

/** Add a friend (or accept an incoming request: add them back by id). */
export async function addFriend(target: PortalTarget): Promise<string> {
    const body = await call<{ id: string }>("/friends", {
        method: "POST",
        json: target,
    });
    return body?.id ?? "";
}

/** Take back **my** edge to `id` (unfriend / cancel a pending request). */
export async function removeFriend(id: string): Promise<void> {
    await call(`/friends/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Refuse: remove the edge `id` wrote towards me. They can add me again. */
export async function refuseFriend(id: string): Promise<void> {
    await call(`/friends/${encodeURIComponent(id)}/incoming`, {
        method: "DELETE",
    });
}

export async function listBlocks(): Promise<readonly PortalBlock[]> {
    const body = await call<{ blocks: PortalBlock[] }>("/blocks");
    return body?.blocks ?? [];
}

/** Block: ends both friend edges and stops them adding me again. */
export async function blockUser(target: PortalTarget): Promise<void> {
    await call("/blocks", { method: "POST", json: target });
}

/** Unblock: restores nothing, only allows new edges. */
export async function unblockUser(id: string): Promise<void> {
    await call(`/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
