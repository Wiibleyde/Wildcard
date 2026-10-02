"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import { roomTopic } from "@/lib/realtime/topics";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";
import { getSupabaseSchema } from "@/lib/supabase/env";

const ROOM_POLL_MS = 3000;

/** Seats and room status, both public-safe and read under RLS. `onChange` must be stable. */
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
                        schema: getSupabaseSchema(),
                        table: "room_players",
                        filter: `room_id=eq.${roomId}`,
                    },
                    () => onChange(),
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: getSupabaseSchema(),
                        table: "rooms",
                        filter: `id=eq.${roomId}`,
                    },
                    () => onChange(),
                ),
        [roomId, onChange],
    );

    return useRealtimeSync(roomTopic(roomId), build, onChange, ROOM_POLL_MS);
}
