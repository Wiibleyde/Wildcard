"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to a game's public meta row. Every applied action bumps
 * `games.version`, which fires an UPDATE here — the single push signal that
 * tells a client "something changed, refetch your private view".
 *
 * We deliberately do **not** stream state over Realtime: the row carries only
 * public meta (version/phase/turn), and the redacted `view()` is pulled per
 * client through the API. Realtime is the doorbell, not the payload.
 *
 * The session token must be handed to the socket *before* subscribing: with
 * cookie-based SSR auth the client otherwise connects as `anon`, and the
 * tables' `authenticated`-only RLS silently drops every change. `onChange`
 * must be stable (`useCallback`).
 */
export function useGameChannel(gameId: string, onChange: () => void): void {
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
                .channel(`game:${gameId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "games",
                        filter: `id=eq.${gameId}`,
                    },
                    () => onChange(),
                )
                .subscribe();
        })();

        return () => {
            active = false;
            if (channel) supabase.removeChannel(channel);
        };
    }, [gameId, onChange]);
}
