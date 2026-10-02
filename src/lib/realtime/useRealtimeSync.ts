"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimeStatus } from "@/lib/realtime/reconnect";
import {
    type ChannelBuilder,
    useAuthedChannel,
} from "@/lib/realtime/useAuthedChannel";

export type { RealtimeStatus };

/**
 * Realtime is lossy across gaps, so every (re)connect, tab refocus and poll
 * tick calls `onChange()` to pull the authoritative state again.
 *
 * `pollMs` runs even while connected: self-hosted CDC can report a channel as
 * subscribed while delivering nothing. Pass `connectedPollMs` only for a
 * channel fed by a server Broadcast, where "connected" really means
 * "receiving"; the poll then relaxes to a heartbeat.
 * `build` and `onChange` must be stable.
 */
export function useRealtimeSync(
    topic: string,
    build: ChannelBuilder,
    onChange: () => void,
    pollMs?: number,
    connectedPollMs?: number,
): RealtimeStatus {
    const [status, setStatus] = useState<RealtimeStatus>("connecting");

    const interval =
        status === "connected" && connectedPollMs ? connectedPollMs : pollMs;
    useEffect(() => {
        if (!interval) return;
        const id = setInterval(() => onChange(), interval);
        return () => clearInterval(id);
    }, [interval, onChange]);

    useEffect(() => {
        // A backgrounded tab can lose its socket silently.
        const onVisible = () => {
            if (document.visibilityState === "visible") onChange();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () =>
            document.removeEventListener("visibilitychange", onVisible);
    }, [onChange]);

    const onStatus = useCallback(
        (next: RealtimeStatus) => {
            setStatus(next);
            if (next === "connected") onChange();
        },
        [onChange],
    );
    useAuthedChannel(topic, build, onStatus);

    return status;
}
