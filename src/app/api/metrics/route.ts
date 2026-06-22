import { metrics } from "@/lib/metrics/registry";

// Node runtime (prom-client + admin DB client are server-only); never cache — value is read at scrape time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prometheus scrape endpoint. Port 3000 is published, so when METRICS_TOKEN is set we require a
// matching bearer token — otherwise the metrics (and the DB read behind them) are public. Unset in local dev.
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
