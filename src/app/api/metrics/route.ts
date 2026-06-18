import { metrics } from "@/lib/metrics/registry";

// Always run on the Node runtime (prom-client + the admin DB client are
// server-only) and never cache — Prometheus needs the value at scrape time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prometheus scrape endpoint. Returns the registry in text exposition format.
 * Scraped by the `prometheus` service over the Docker network (see
 * monitoring/prometheus/prometheus.yml); not meant for the public internet.
 */
export async function GET(): Promise<Response> {
    const body = await metrics.registry.metrics();
    return new Response(body, {
        status: 200,
        headers: { "Content-Type": metrics.registry.contentType },
    });
}
