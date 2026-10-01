import { NextResponse } from "next/server";

/** Default JSON body cap for game/room/matchmaking routes. */
export const DEFAULT_MAX_BODY_BYTES = 16 * 1024;

export type BodyResult<T> =
    | { readonly ok: true; readonly body: T }
    | { readonly ok: false; readonly response: NextResponse };

function fail(error: string, status: number): BodyResult<never> {
    return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Read the raw body as UTF-8, refusing anything over `maxBytes` *before* it is
 * buffered in full: a lying/absent `Content-Length` is backed by counting the
 * streamed bytes and cancelling the stream as soon as the cap is crossed. So an
 * oversized payload costs at most `maxBytes` of memory, never its full size.
 */
async function readCappedText(
    request: Request,
    maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
    if (!request.body) return { ok: true, text: "" };

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            return { ok: false };
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { ok: true, text: new TextDecoder().decode(bytes) };
}

/**
 * Parse a size-capped JSON body. `413 payload_too_large` past `maxBytes`,
 * `400 invalid_json` when malformed. An empty body parses to `undefined`
 * (routes without a body stay callable with a bare POST).
 */
export async function readJsonBody(
    request: Request,
    maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<BodyResult<unknown>> {
    const read = await readCappedText(request, maxBytes);
    if (!read.ok) return fail("payload_too_large", 413);
    if (read.text.trim() === "") return { ok: true, body: undefined };
    try {
        const body: unknown = JSON.parse(read.text);
        return { ok: true, body };
    } catch {
        return fail("invalid_json", 400);
    }
}

/** True for a plain JSON object (not null, not an array). */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * {@link readJsonBody} for routes whose body must be a JSON object. An empty
 * body yields `{}` so field validation reports the precise missing field; any
 * other non-object JSON (array, string, number…) is a `400 invalid_body`.
 */
export async function readJsonObject(
    request: Request,
    maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<BodyResult<Record<string, unknown>>> {
    const parsed = await readJsonBody(request, maxBytes);
    if (!parsed.ok) return parsed;
    if (parsed.body === undefined) return { ok: true, body: {} };
    if (!isJsonObject(parsed.body)) return fail("invalid_body", 400);
    return { ok: true, body: parsed.body };
}
