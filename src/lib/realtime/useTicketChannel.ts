"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback } from "react";
import { ticketTopic } from "@/lib/realtime/topics";
import {
    type RealtimeStatus,
    useRealtimeSync,
} from "@/lib/realtime/useRealtimeSync";
import { getSupabaseSchema } from "@/lib/supabase/env";

const TICKET_POLL_MS = 2000;

/**
 * The caller's own ticket (RLS shows only that row): its UPDATE is the "you've
 * been matched" doorbell. `onChange` must be stable.
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
                    schema: getSupabaseSchema(),
                    table: "matchmaking_tickets",
                    filter: `user_id=eq.${userId}`,
                },
                () => onChange(),
            ),
        [userId, onChange],
    );

    return useRealtimeSync(
        ticketTopic(userId),
        build,
        onChange,
        TICKET_POLL_MS,
    );
}
