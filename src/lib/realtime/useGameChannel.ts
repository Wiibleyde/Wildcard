"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import { GAME_VERSION_EVENT, gameTopic } from "@/lib/realtime/topics";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";
import { getSupabaseSchema } from "@/lib/supabase/env";

/** Heartbeat poll while the channel is connected (see below). */
const CONNECTED_POLL_MS = 5000;

/** Reads a `version` number out of an untyped Realtime payload. */
function versionOf(value: unknown): number | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const v = (value as { version?: unknown }).version;
    return typeof v === "number" && Number.isInteger(v) ? v : undefined;
}

/**
 * Subscribe to a game's doorbell. Every committed move rings it twice over:
 * - a server **Broadcast** `{ version }` (`notifyGameVersion`) — the primary
 *   signal, independent of CDC, so it reliably reaches a subscribed client;
 * - the `postgres_changes` UPDATE on the public `games` row — the fallback,
 *   and the only signal for out-of-band ends (forfeit, admin close).
 *
 * `onChange(version)` receives the announced version so the caller can skip
 * the probe and drop duplicate rings for free; it is called with no argument
 * for a resync (reconnect, tab refocus, poll tick).
 *
 * We deliberately do **not** stream state over Realtime: the signal carries
 * only a version number, and the redacted `view()` is pulled per client
 * through the API. Realtime is the doorbell, not the payload.
 *
 * Polling: `pollMs` while the channel is down; once connected the Broadcast is
 * trusted and the poll drops to a {@link CONNECTED_POLL_MS} heartbeat (missed
 * ring, stalled bot chain self-heal). `onChange` must be stable.
 */
export function useGameChannel(
    gameId: string,
    onChange: (version?: number) => void,
    pollMs = 1000,
): RealtimeStatus {
    const build = useCallback(
        (channel: RealtimeChannel) =>
            channel
                .on("broadcast", { event: GAME_VERSION_EVENT }, (msg) =>
                    onChange(versionOf(msg.payload)),
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: getSupabaseSchema(),
                        table: "games",
                        filter: `id=eq.${gameId}`,
                    },
                    (change) => onChange(versionOf(change.new)),
                ),
        [gameId, onChange],
    );

    return useRealtimeSync(
        gameTopic(gameId),
        build,
        onChange,
        pollMs,
        CONNECTED_POLL_MS,
    );
}
