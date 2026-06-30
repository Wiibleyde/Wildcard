"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";

/**
 * Subscribe to the caller's own matchmaking ticket. RLS exposes only this one
 * row to its owner, so the "you've been matched" UPDATE (room_id set) is pushed
 * to exactly this client — the doorbell that turns a search into a game. The
 * consumer refetches its status on every change. `onChange` must be stable.
 */
export function useTicketChannel(
    userId: string,
    onChange: () => void,
): RealtimeStatus {
    const build = useCallback(
        (channel: RealtimeChannel) =>
            channel.on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "matchmaking_tickets",
                    filter: `user_id=eq.${userId}`,
                },
                () => onChange(),
            ),
        [userId, onChange],
    );

    // Poll every 2s while Realtime is down so a match still lands promptly.
    return useRealtimeSync(`mm:${userId}`, build, onChange, 2000);
}
