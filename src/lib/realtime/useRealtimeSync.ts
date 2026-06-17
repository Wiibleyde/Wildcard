"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
    backoffDelay,
    classifyChannelStatus,
    type RealtimeStatus,
} from "@/lib/realtime/reconnect";
import { createClient } from "@/lib/supabase/client";

export type { RealtimeStatus };

/** Attaches the per-feature `.on(...)` listeners to a fresh channel. */
type ChannelBuilder = (channel: RealtimeChannel) => RealtimeChannel;

/**
 * Shared resilience core for every Realtime subscription. Realtime is push-only
 * and lossy across gaps, so this hook turns "the socket came back" into "pull
 * the authoritative state again" and exposes the connection health for a UI
 * indicator.
 *
 * Guarantees (ticket: *Reconnexion auto Realtime*):
 * - **Détection de déconnexion** — the browser `offline` event is the primary
 *   signal: a pure socket drop (lost network, sleeping laptop) does *not* fire
 *   the channel's `.subscribe` status callback — Phoenix rejoins silently — so
 *   we can't rely on it alone. The status callback still catches channel-level
 *   failures (CHANNEL_ERROR / TIMED_OUT / CLOSED).
 * - **Re-souscription + refetch** — `online` forces a prompt re-join instead of
 *   waiting on the socket's backoff timer; channel errors re-join with capped
 *   exponential backoff. Every (re)`SUBSCRIBED` fires `onChange()`, so nothing
 *   missed while detached survives as stale state.
 * - extra pulls cover the gaps Realtime never reports: a backgrounded tab that
 *   silently lost its socket (`visibilitychange`) and an expired access token
 *   (~1h) re-fed to the socket on every auth refresh, or RLS starts dropping
 *   changes mid-game.
 *
 * The session token must be set on the socket *before* subscribing, or the
 * cookie-based SSR client connects as `anon` and the `authenticated`-only RLS
 * drops every change. Both `build` and `onChange` must be stable
 * (`useCallback`).
 */
export function useRealtimeSync(
    topic: string,
    build: ChannelBuilder,
    onChange: () => void,
): RealtimeStatus {
    const [status, setStatus] = useState<RealtimeStatus>("connecting");

    useEffect(() => {
        const supabase = createClient();
        let channel: RealtimeChannel | undefined;
        let active = true;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        // Until the channel has SUBSCRIBED at least once, a failure means "still
        // trying to connect", not "lost an established connection". We retry
        // silently in that window instead of nagging with the reconnect banner —
        // otherwise an environment where Realtime never establishes (e.g. the
        // postgres_changes publication isn't live) shows the banner forever.
        let hasConnected = false;
        // Each (re)join bumps the epoch; status callbacks from a superseded
        // channel carry a stale epoch and are ignored, so tearing an old
        // channel down never schedules a spurious re-join against the new one.
        let epoch = 0;

        const onVisible = () => {
            if (document.visibilityState === "visible") onChange();
        };
        document.addEventListener("visibilitychange", onVisible);

        // Network loss is the common "perte de connexion" and the one Realtime
        // hides: flag it immediately, and on recovery force a prompt re-join
        // rather than waiting out the socket's backoff timer.
        const onOffline = () => {
            // Only surface a drop once we've actually been connected.
            if (active && hasConnected) setStatus("reconnecting");
        };
        const onOnline = () => {
            if (!active) return;
            attempt = 0;
            if (retry) {
                clearTimeout(retry);
                retry = undefined;
            }
            if (channel) supabase.removeChannel(channel);
            join();
        };
        window.addEventListener("offline", onOffline);
        window.addEventListener("online", onOnline);

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
        });

        const scheduleRejoin = () => {
            if (!active || retry) return;
            const delay = backoffDelay(attempt);
            attempt += 1;
            retry = setTimeout(() => {
                retry = undefined;
                if (!active) return;
                if (channel) supabase.removeChannel(channel);
                join();
            }, delay);
        };

        const join = async () => {
            const myEpoch = ++epoch;
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active || myEpoch !== epoch) return;
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
            channel = build(supabase.channel(topic)).subscribe((s) => {
                if (!active || myEpoch !== epoch) return;
                const next = classifyChannelStatus(s);
                if (!next) return;
                if (next.status === "connected") {
                    hasConnected = true;
                    attempt = 0;
                    setStatus("connected");
                    // Resync to cover anything missed while detached.
                    onChange();
                } else if (next.rejoin) {
                    // Pre-first-connect failures stay "connecting" (silent);
                    // only a dropped, established channel nags as "reconnecting".
                    setStatus(hasConnected ? "reconnecting" : "connecting");
                    scheduleRejoin();
                }
            });
        };

        join();

        return () => {
            active = false;
            if (retry) clearTimeout(retry);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("online", onOnline);
            subscription.unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    }, [topic, build, onChange]);

    return status;
}
