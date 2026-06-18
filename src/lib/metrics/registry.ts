import {
    Counter,
    collectDefaultMetrics,
    Gauge,
    Histogram,
    Registry,
} from "prom-client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Prometheus instrumentation for Wildcard.
 *
 * Two kinds of metric live here, deliberately:
 *
 *  1. **Runtime counters/histograms** — fed by the server as actions flow
 *     through it (`recordMove`, `recordGameStarted`, `recordGameFinished`).
 *     They reset to 0 on restart; Prometheus handles counter resets natively,
 *     so rates stay correct across deploys.
 *  2. **Scrape-time gauges** — `wildcard_active_games` reads the current
 *     `games` table on every `/api/metrics` scrape via an async `collect`.
 *     A gauge mirrors live state, so a DB read (not an in-memory tally that
 *     would drift after a restart) is the honest source.
 *
 * The whole module is a process singleton, cached on `globalThis` so Next.js
 * dev hot-reload doesn't re-register metrics ("metric already registered").
 */

const GLOBAL_KEY = Symbol.for("wildcard.metrics.registry");

interface MetricsBundle {
    readonly registry: Registry;
    readonly moveDuration: Histogram<"module">;
    readonly movesTotal: Counter<"module" | "result">;
    readonly gamesStarted: Counter<"module">;
    readonly gamesFinished: Counter<"module">;
    readonly gameDuration: Histogram<"module">;
    readonly activeGames: Gauge<"module">;
}

type GlobalWithMetrics = typeof globalThis & {
    [GLOBAL_KEY]?: MetricsBundle;
};

/**
 * Refresh `wildcard_active_games` from the database at scrape time. Counts
 * live games (`is_over = false`) per module. A failed read leaves the gauge
 * empty rather than throwing — the scrape must never 500 because Postgres
 * blinked.
 */
async function collectActiveGames(gauge: Gauge<"module">): Promise<void> {
    gauge.reset();
    try {
        const admin = createAdminClient();
        const { data } = await admin
            .from("games")
            .select("module_id")
            .eq("is_over", false);
        const perModule = new Map<string, number>();
        for (const row of data ?? []) {
            perModule.set(
                row.module_id,
                (perModule.get(row.module_id) ?? 0) + 1,
            );
        }
        for (const [module, count] of perModule) {
            gauge.set({ module }, count);
        }
    } catch (err) {
        // Degrade the gauge, never the scrape — but warn so a persistently
        // broken collect is visible instead of silently reading empty forever.
        console.warn("[metrics] active-games collect failed:", err);
    }
}

function build(): MetricsBundle {
    const registry = new Registry();
    registry.setDefaultLabels({ app: "wildcard" });

    // Node/process internals (CPU, heap, event-loop lag, GC) under the same
    // prefix — free infra observability alongside the business metrics.
    collectDefaultMetrics({ register: registry, prefix: "wildcard_" });

    const moveDuration = new Histogram({
        name: "wildcard_move_duration_ms",
        help: "Server-side latency of applying one game action (validate + reduce + persist), in milliseconds.",
        labelNames: ["module"] as const,
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        registers: [registry],
    });

    const movesTotal = new Counter({
        name: "wildcard_moves_total",
        help: "Total game actions submitted, by module and outcome (ok or the apply error code).",
        labelNames: ["module", "result"] as const,
        registers: [registry],
    });

    const gamesStarted = new Counter({
        name: "wildcard_games_started_total",
        help: "Games dealt, by module.",
        labelNames: ["module"] as const,
        registers: [registry],
    });

    const gamesFinished = new Counter({
        name: "wildcard_games_finished_total",
        help: "Games that reached a terminal state, by module. Compared with started gives the abandon rate.",
        labelNames: ["module"] as const,
        registers: [registry],
    });

    const gameDuration = new Histogram({
        name: "wildcard_game_duration_seconds",
        help: "Wall-clock duration of a finished game (deal → terminal state), in seconds.",
        labelNames: ["module"] as const,
        buckets: [10, 30, 60, 120, 300, 600, 1200, 1800, 3600],
        registers: [registry],
    });

    const activeGames = new Gauge({
        name: "wildcard_active_games",
        help: "Games currently in progress (is_over = false), by module. Read from the database at scrape time.",
        labelNames: ["module"] as const,
        registers: [registry],
        async collect() {
            await collectActiveGames(this);
        },
    });

    return {
        registry,
        moveDuration,
        movesTotal,
        gamesStarted,
        gamesFinished,
        gameDuration,
        activeGames,
    };
}

function getMetrics(): MetricsBundle {
    const g = globalThis as GlobalWithMetrics;
    if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = build();
    return g[GLOBAL_KEY];
}

export const metrics = getMetrics();

/** Record one applied action: its latency and outcome, labelled by module. */
export function recordMove(
    moduleId: string,
    result: string,
    durationMs: number,
): void {
    metrics.movesTotal.inc({ module: moduleId, result });
    if (result === "ok") {
        metrics.moveDuration.observe({ module: moduleId }, durationMs);
    }
}

/** Record a freshly dealt game. */
export function recordGameStarted(moduleId: string): void {
    metrics.gamesStarted.inc({ module: moduleId });
}

/**
 * Record a game reaching its terminal state, with its total duration. Safe to
 * call from any code path that flips `is_over` true; callers guard against
 * double-counting (only the action that *causes* the end calls this).
 */
export function recordGameFinished(
    moduleId: string,
    durationSeconds: number,
): void {
    metrics.gamesFinished.inc({ module: moduleId });
    if (durationSeconds >= 0) {
        metrics.gameDuration.observe({ module: moduleId }, durationSeconds);
    }
}
