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
 *
 * Resilience mirrors {@link useGameChannel}: resync on every (re)subscribe,
 * refetch when the tab returns to the foreground, and keep the socket's
 * token fresh across auth refreshes — otherwise a dropped socket or an
 * expired JWT leaves the lobby stale until a manual reload.
 */
export function useRoomChannel(roomId: string, onChange: () => void): void {
    useEffect(() => {
        const supabase = createClient();
        let channel: ReturnType<typeof supabase.channel> | undefined;
        let active = true;

        const onVisible = () => {
            if (document.visibilityState === "visible") onChange();
        };
        document.addEventListener("visibilitychange", onVisible);

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
        });

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
                .subscribe((status) => {
                    if (status === "SUBSCRIBED") onChange();
                });
        })();

        return () => {
            active = false;
            document.removeEventListener("visibilitychange", onVisible);
            subscription.unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    }, [roomId, onChange]);
}
