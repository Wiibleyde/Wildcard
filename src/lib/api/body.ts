import { NextResponse } from "next/server";
import { isJsonObject } from "@/lib/json";

export const DEFAULT_MAX_BODY_BYTES = 16 * 1024;

export type BodyResult<T> =
    | { readonly ok: true; readonly body: T }
    | { readonly ok: false; readonly response: NextResponse };

function fail(error: string, status: number): BodyResult<never> {
    return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Counts streamed bytes and cancels past `maxBytes`, so a lying or absent
 * Content-Length never makes the server buffer an oversized payload.
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

/** 413 `payload_too_large`, 400 `invalid_json`; an empty body is `undefined`. */
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

/** Empty body → `{}` (field validation names the missing field); non-object → 400 `invalid_body`. */
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
