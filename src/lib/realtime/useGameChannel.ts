"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";

/**
 * Subscribe to a game's public meta row. Every applied action bumps
 * `games.version`, which fires an UPDATE here — the single push signal that
 * tells a client "something changed, refetch your private view".
 *
 * We deliberately do **not** stream state over Realtime: the row carries only
 * public meta (version/phase/turn), and the redacted `view()` is pulled per
 * client through the API. Realtime is the doorbell, not the payload.
 *
 * Returns the connection health (see {@link RealtimeStatus}); resilience —
 * disconnect detection, auto re-join, resync on every gap — lives in
 * {@link useRealtimeSync}. `onChange` must be stable (`useCallback`).
 */
export function useGameChannel(
    gameId: string,
    onChange: () => void,
    /**
     * Backstop poll interval (ms). Callers pass a larger value while the viewer
     * is on turn (nothing external changes then) and a small one otherwise, to
     * catch opponent/bot moves promptly without polling needlessly. Defaults to
     * the bot-move pacing.
     */
    pollMs = 800,
): RealtimeStatus {
    const build = useCallback(
        (channel: RealtimeChannel) =>
            channel.on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "games",
                    filter: `id=eq.${gameId}`,
                },
                () => onChange(),
            ),
        [gameId, onChange],
    );

    // Backstop poll (see pollMs). Kept at/below the bot-move pacing
    // (BOT_TURN_DELAY_MS, 900ms) when others are acting, so the fallback catches
    // one move per tick instead of a burst — otherwise three bots resolve
    // between two polls and the board jumps "three moves at a time".
    return useRealtimeSync(`game:${gameId}`, build, onChange, pollMs);
}
