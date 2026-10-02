import { createHash, timingSafeEqual } from "node:crypto";
import { metrics } from "@/lib/metrics/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hashing first gives equal-length buffers and leaks neither content nor length. */
function bearerMatches(header: string | null, token: string): boolean {
    const presented = header?.startsWith("Bearer ") ? header.slice(7) : "";
    const a = createHash("sha256").update(presented).digest();
    const b = createHash("sha256").update(token).digest();
    return timingSafeEqual(a, b);
}

// Port 3000 is published and each scrape runs a service-role read: closed by
// default (404 without METRICS_TOKEN), bearer-protected otherwise.
export async function GET(request: Request): Promise<Response> {
    const token = process.env.METRICS_TOKEN;
    if (!token) return new Response("Not Found", { status: 404 });
    if (!bearerMatches(request.headers.get("authorization"), token)) {
        return new Response("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": "Bearer" },
        });
    }

    const body = await metrics.registry.metrics();
    return new Response(body, {
        status: 200,
        headers: { "Content-Type": metrics.registry.contentType },
    });
}
