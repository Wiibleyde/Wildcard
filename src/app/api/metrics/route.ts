import { createHash, timingSafeEqual } from "node:crypto";
import { metrics } from "@/lib/metrics/registry";

// Node runtime (prom-client + admin DB client are server-only); never cache — value is read at scrape time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time bearer check. Both sides are hashed first so the comparison
 * runs on equal-length buffers (timingSafeEqual throws otherwise) and leaks
 * neither the token's content nor its length through timing.
 */
function bearerMatches(header: string | null, token: string): boolean {
    const presented = header?.startsWith("Bearer ") ? header.slice(7) : "";
    const a = createHash("sha256").update(presented).digest();
    const b = createHash("sha256").update(token).digest();
    return timingSafeEqual(a, b);
}

// Prometheus scrape endpoint. Port 3000 is published and every scrape runs a service-role DB read, so
// the endpoint is closed by default: with METRICS_TOKEN unset it answers 404 (as if absent), and with
// it set a matching `Authorization: Bearer <token>` is required. Set METRICS_TOKEN in local dev to scrape.
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
