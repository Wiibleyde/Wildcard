import { describe, expect, it } from "vitest";
import { readJsonBody, readJsonObject } from "./body";

function post(body: BodyInit | null, headers?: Record<string, string>) {
    return new Request("http://localhost/api/x", {
        method: "POST",
        body,
        headers,
    });
}

/** A body streamed without a Content-Length (chunked upload). */
function streamed(chunks: string[]): Request {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const c of chunks) controller.enqueue(encoder.encode(c));
            controller.close();
        },
    });
    return new Request("http://localhost/api/x", {
        method: "POST",
        body: stream,
        // Required by undici for a streamed request body.
        duplex: "half",
    } as RequestInit);
}

describe("readJsonBody", () => {
    it("parses a valid JSON body", async () => {
        const res = await readJsonBody(post(JSON.stringify({ a: 1 })));
        expect(res).toEqual({ ok: true, body: { a: 1 } });
    });

    it("treats an empty body as undefined", async () => {
        expect(await readJsonBody(post(null))).toEqual({
            ok: true,
            body: undefined,
        });
        expect(await readJsonBody(post(""))).toEqual({
            ok: true,
            body: undefined,
        });
    });

    it("rejects malformed JSON with 400 invalid_json", async () => {
        const res = await readJsonBody(post("{nope"));
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.response.status).toBe(400);
        expect(await res.response.json()).toEqual({ error: "invalid_json" });
    });

    it("rejects an oversized body with 413 (declared length)", async () => {
        const big = JSON.stringify({ pad: "x".repeat(100) });
        const res = await readJsonBody(post(big), 32);
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.response.status).toBe(413);
        expect(await res.response.json()).toEqual({
            error: "payload_too_large",
        });
    });

    it("rejects an oversized streamed body with no Content-Length", async () => {
        const res = await readJsonBody(
            streamed(['{"pad":"', "x".repeat(40), "x".repeat(40), '"}']),
            32,
        );
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.response.status).toBe(413);
    });

    it("counts bytes, not characters", async () => {
        // 10 euro signs = 10 chars but 30 UTF-8 bytes (+ quotes).
        const res = await readJsonBody(streamed([`"${"€".repeat(10)}"`]), 20);
        expect(res.ok).toBe(false);
    });

    it("accepts a body exactly at the cap", async () => {
        const body = JSON.stringify("x".repeat(30)); // 32 bytes
        const res = await readJsonBody(streamed([body]), 32);
        expect(res).toEqual({ ok: true, body: "x".repeat(30) });
    });
});

describe("readJsonObject", () => {
    it("returns {} for an empty body", async () => {
        expect(await readJsonObject(post(null))).toEqual({
            ok: true,
            body: {},
        });
    });

    it("rejects non-object JSON with 400 invalid_body", async () => {
        for (const raw of ["[1,2]", "42", '"str"', "null"]) {
            const res = await readJsonObject(post(raw));
            expect(res.ok).toBe(false);
            if (res.ok) continue;
            expect(res.response.status).toBe(400);
            expect(await res.response.json()).toEqual({
                error: "invalid_body",
            });
        }
    });

    it("passes a JSON object through", async () => {
        expect(await readJsonObject(post('{"moduleId":"bataille"}'))).toEqual({
            ok: true,
            body: { moduleId: "bataille" },
        });
    });
});
