import { NextResponse } from "next/server";

/**
 * A failed model result: a stable machine code (`error`) the client can switch
 * on, plus an optional internal `message` (the DB/driver text) that is logged
 * for operators but never sent to the client.
 */
export interface ModelFailure<E extends string> {
    readonly ok: false;
    readonly error: E;
    readonly message?: string;
}

/**
 * Turn a model failure into its HTTP response through the model's status map
 * (`ROOM_ERROR_STATUS`, `MATCH_ERROR_STATUS`, …). Server-side failures (5xx)
 * are logged with their internal `message` — without this, every `db_error`
 * was a bare "500" with no trace of which query failed or why.
 *
 * `extra` adds client-safe fields to the body (e.g. a rule `violation`).
 *
 * ```ts
 * if (!result.ok) return failureResponse("rooms.join", result, ROOM_ERROR_STATUS);
 * ```
 */
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
