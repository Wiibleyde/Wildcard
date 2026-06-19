/**
 * Server startup hook (Next.js 16, stable). `register()` runs **once** per
 * server instance, before it serves any request.
 *
 * We use it to sweep dead games left over from previous runs: bot-only tables
 * whose humans all left (their bot chain died with the old process) and games
 * idle for over a day. See {@link reapStaleGames}. Anything left ongoing now is
 * either freshly created or genuinely live.
 *
 * Node-only: the service-role Supabase client and its secret key must never run
 * in the Edge runtime. The whole pass is best-effort — a failure here must
 * never block the server from coming up, so it is logged and swallowed.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { reapStaleGames } = await import("@/lib/models/maintenance");

        const summary = await reapStaleGames(createAdminClient());
        if (summary.reaped > 0) {
            console.info(
                `[maintenance] reaped ${summary.reaped} stale game(s) on boot ` +
                    `(${summary.botOnly} bot-only, ${summary.afk} afk)`,
            );
        }
    } catch (err) {
        console.warn("[maintenance] startup game reap failed:", err);
    }
}
