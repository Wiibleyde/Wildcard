"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";

/**
 * Subscribe to a lobby: seat changes (`room_players`) and room status changes
 * (`rooms`). Both are public-safe tables, so clients read them directly under
 * RLS — Realtime pushes the deltas, the consumer refetches the current seats /
 * status and reacts (e.g. navigates everyone into the game when it starts).
 *
 * Returns the connection health (see {@link RealtimeStatus}); resilience —
 * disconnect detection, auto re-join, resync on every gap — lives in
 * {@link useRealtimeSync}. `onChange` must be stable (`useCallback`).
 */
export function useRoomChannel(
    roomId: string,
    onChange: () => void,
): RealtimeStatus {
    const build = useCallback(
        (channel: RealtimeChannel) =>
            channel
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "room_players",
                        filter: `room_id=eq.${roomId}`,
                    },
                    () => onChange(),
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "rooms",
                        filter: `id=eq.${roomId}`,
                    },
                    () => onChange(),
                ),
        [roomId, onChange],
    );

    // Poll every 3s while Realtime is down so the lobby roster (joins, bots,
    // spectators, start) still refreshes for everyone.
    return useRealtimeSync(`room:${roomId}`, build, onChange, 3000);
}
