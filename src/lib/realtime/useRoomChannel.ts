"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to a lobby: seat changes (`room_players`) and room status changes
 * (`rooms`). Both are public-safe tables, so clients read them directly under
 * RLS — Realtime pushes the deltas, the consumer refetches the current seats /
 * status and reacts (e.g. navigates everyone into the game when it starts).
 *
 * The session token must be set on the socket *before* subscribing, or the
 * cookie-based SSR client connects as `anon` and the `authenticated`-only RLS
 * drops every change. `onChange` must be stable (`useCallback`).
 */
export function useRoomChannel(roomId: string, onChange: () => void): void {
    useEffect(() => {
        const supabase = createClient();
        let channel: ReturnType<typeof supabase.channel> | undefined;
        let active = true;

        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active) return;
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
            channel = supabase
                .channel(`room:${roomId}`)
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
                )
                .subscribe();
        })();

        return () => {
            active = false;
            if (channel) supabase.removeChannel(channel);
        };
    }, [roomId, onChange]);
}
