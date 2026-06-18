import { metrics } from "@/lib/metrics/registry";

// Always run on the Node runtime (prom-client + the admin DB client are
// server-only) and never cache — Prometheus needs the value at scrape time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prometheus scrape endpoint. Returns the registry in text exposition format.
 * Scraped by the `prometheus` service over the Docker network (see
 * monitoring/prometheus/prometheus.yml).
 *
 * The app's port 3000 is published, so this route is reachable from outside the
 * Docker network. When `METRICS_TOKEN` is set we require a matching bearer token
 * (Prometheus sends it via its `authorization` scrape config) — otherwise the
 * metrics, and the scrape-time DB read behind `wildcard_active_games`, would be
 * exposed to anyone. The var is left unset in local dev, where the route is open.
 */
export async function GET(request: Request): Promise<Response> {
    const token = process.env.METRICS_TOKEN;
    if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const body = await metrics.registry.metrics();
    return new Response(body, {
        status: 200,
        headers: { "Content-Type": metrics.registry.contentType },
    });
}
