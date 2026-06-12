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
 *
 * Resilience — Realtime is push-only and lossy across gaps, so every way a
 * gap can open triggers a pull:
 * - `SUBSCRIBED` fires on the first join *and* on every rejoin after a
 *   socket drop — resync to cover anything missed while detached.
 * - A backgrounded tab can lose the socket without an error; refetch when
 *   it becomes visible again.
 * - The access token expires (~1h); re-feed each refreshed token to the
 *   socket or RLS starts silently dropping changes mid-game.
 */
export function useGameChannel(gameId: string, onChange: () => void): void {
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
    }, [gameId, onChange]);
}
