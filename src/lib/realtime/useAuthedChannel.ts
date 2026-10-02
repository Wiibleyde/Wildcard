"use client";

import type {
    RealtimeChannel,
    RealtimeChannelOptions,
} from "@supabase/supabase-js";
import { type RefObject, useEffect, useRef } from "react";
import {
    backoffDelay,
    classifyChannelStatus,
    type RealtimeStatus,
} from "@/lib/realtime/reconnect";
import { createClient } from "@/lib/supabase/client";

export type ChannelBuilder = (channel: RealtimeChannel) => RealtimeChannel;

/**
 * A Realtime channel joined with the session token and kept alive: re-join
 * with capped backoff on channel errors, at once when the browser comes back
 * online. The token must be on the socket *before* subscribing, or the cookie
 * client joins as `anon` and authenticated-only Realtime rejects it.
 *
 * `onStatus` hears `connected` on every (re)subscribe, and `reconnecting` only
 * after a first success, so a stack where Realtime never connects stays quiet.
 * `build`, `onStatus` and `options` must be stable. Returns the live channel.
 */
export function useAuthedChannel(
    topic: string,
    build: ChannelBuilder,
    onStatus: (status: RealtimeStatus) => void,
    options?: RealtimeChannelOptions,
): RefObject<RealtimeChannel | null> {
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        const supabase = createClient();
        let channel: RealtimeChannel | undefined;
        let active = true;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        let hasConnected = false;
        // Status callbacks of a superseded channel carry a stale epoch and are ignored.
        let epoch = 0;

        const drop = () => {
            if (channel) supabase.removeChannel(channel);
            channelRef.current = null;
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
            channel = build(supabase.channel(topic, options)).subscribe((s) => {
                if (!active || myEpoch !== epoch) return;
                const next = classifyChannelStatus(s);
                if (!next) return;
                if (next.status === "connected") {
                    hasConnected = true;
                    attempt = 0;
                    onStatus("connected");
                } else if (next.rejoin) {
                    onStatus(hasConnected ? "reconnecting" : "connecting");
                    scheduleRejoin();
                }
            });
            channelRef.current = channel;
        };

        const scheduleRejoin = () => {
            if (!active || retry) return;
            const delay = backoffDelay(attempt);
            attempt += 1;
            retry = setTimeout(() => {
                retry = undefined;
                if (!active) return;
                drop();
                join();
            }, delay);
        };

        // A pure socket drop never reaches the channel status callback.
        const onOffline = () => {
            if (active && hasConnected) onStatus("reconnecting");
        };
        const onOnline = () => {
            if (!active) return;
            attempt = 0;
            if (retry) {
                clearTimeout(retry);
                retry = undefined;
            }
            drop();
            join();
        };
        window.addEventListener("offline", onOffline);
        window.addEventListener("online", onOnline);

        // Keep the socket token fresh across the ~1h access-token refresh.
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
        });

        join();

        return () => {
            active = false;
            if (retry) clearTimeout(retry);
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("online", onOnline);
            subscription.unsubscribe();
            drop();
        };
    }, [topic, build, onStatus, options]);

    return channelRef;
}
