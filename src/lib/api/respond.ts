import { NextResponse } from "next/server";

// Model read-error policy: a DB error is never reported as missing/forbidden.
// Mutations and authoritative reads return `{ ok: false, error: "db_error" }`;
// page lists throw (error boundary); cosmetic reads (names, styles, log,
// settings, role) log and fall back to their safe default.

/** `message` is internal (logged on 5xx), never sent to the client. */
export interface ModelFailure<E extends string> {
    readonly ok: false;
    readonly error: E;
    readonly message?: string;
}

/** `extra` adds client-safe fields (e.g. a rule `violation`). */
export function failureResponse<E extends string>(
    route: string,
    failure: ModelFailure<E>,
    statusMap: Readonly<Record<E, number>>,
    extra?: Readonly<Record<string, unknown>>,
): NextResponse {
    const status = statusMap[failure.error] ?? 500;
    if (status >= 500) {
        console.error(
            `[api] ${route} failed: ${failure.error}`,
            failure.message ?? "(no detail)",
        );
    }
    return NextResponse.json({ ...extra, error: failure.error }, { status });
}
