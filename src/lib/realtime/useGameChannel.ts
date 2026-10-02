"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import { GAME_VERSION_EVENT, gameTopic } from "@/lib/realtime/topics";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";
import { getSupabaseSchema } from "@/lib/supabase/env";

/** Heartbeat once the Broadcast is trusted: missed ring, stalled bot chain self-heal. */
const CONNECTED_POLL_MS = 5000;

function versionOf(value: unknown): number | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const v = (value as { version?: unknown }).version;
    return typeof v === "number" && Number.isInteger(v) ? v : undefined;
}

/**
 * The game's doorbell: the server Broadcast `{ version }` (primary, CDC-free)
 * and the `games` row UPDATE (fallback). Only a version crosses Realtime; the
 * redacted view is pulled through the API. `onChange(version)` gets the
 * announced version, or nothing for a resync. `onChange` must be stable.
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
