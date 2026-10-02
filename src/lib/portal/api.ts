"use client";

import { portalFetch, readApiJson } from "@/lib/api/client";
import { portalApiUrl } from "@/lib/auth/urls";

// The portal API rather than PostgREST on `portal`: its contract is stable
// (the tables are not), and it still calls Supabase with the user's own token.

/** A directed edge: real friendship is `mutual`. */
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

/** A stranger by exact pseudo, or someone on screen by id. */
export type PortalTarget =
    | { readonly pseudo: string }
    | { readonly id: string };

/** The portal's `message` is French-only; switch on the code. */
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

/** Same rule as the portal. */
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
    const body = await readApiJson<{ error?: unknown; message?: unknown }>(res);
    if (!res.ok) {
        const raw = typeof body?.error === "string" ? body.error : "";
        const code = (
            KNOWN_CODES.has(raw) ? raw : "upstream"
        ) as PortalErrorCode;
        const message = typeof body?.message === "string" ? body.message : raw;
        throw new PortalApiError(code, res.status, message);
    }
    return body as T | null;
}

/** Mutual first, then waiting for them, then waiting for me. */
export async function listFriends(): Promise<readonly PortalFriend[]> {
    const body = await call<{ friends: PortalFriend[] }>("/friends");
    return body?.friends ?? [];
}

/** Also accepts an incoming request (add them back by id). */
export async function addFriend(target: PortalTarget): Promise<string> {
    const body = await call<{ id: string }>("/friends", {
        method: "POST",
        json: target,
    });
    return body?.id ?? "";
}

/** Take back my edge (unfriend / cancel a request). */
export async function removeFriend(id: string): Promise<void> {
    await call(`/friends/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Remove their edge towards me; they can add me again. */
export async function refuseFriend(id: string): Promise<void> {
    await call(`/friends/${encodeURIComponent(id)}/incoming`, {
        method: "DELETE",
    });
}

export async function listBlocks(): Promise<readonly PortalBlock[]> {
    const body = await call<{ blocks: PortalBlock[] }>("/blocks");
    return body?.blocks ?? [];
}

/** Ends both friend edges and stops them adding me again. */
export async function blockUser(target: PortalTarget): Promise<void> {
    await call("/blocks", { method: "POST", json: target });
}

export async function unblockUser(id: string): Promise<void> {
    await call(`/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
