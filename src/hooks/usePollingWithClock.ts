"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Options = {
    refreshMs: number;
    clockMs?: number;
};

/**
 * Ticks a clock so relative timestamps stay fresh without re-fetching, and
 * polls `router.refresh()` on an interval. `refreshNow` flips `refreshing` for
 * ~600ms to debounce the UI.
 *
 * `now` is `null` during SSR and the hydration render: a server timestamp
 * would never match the client's (seconds-granularity relative times →
 * hydration mismatch), so callers render time-dependent text only once it's set.
 */
export function usePollingWithClock({ refreshMs, clockMs = 1000 }: Options) {
    const router = useRouter();
    const [now, setNow] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const debounce = useRef<number | null>(null);

    useEffect(() => {
        setNow(Date.now());
        const clock = setInterval(() => setNow(Date.now()), clockMs);
        const poll = setInterval(() => router.refresh(), refreshMs);
        return () => {
            clearInterval(clock);
            clearInterval(poll);
        };
    }, [router, refreshMs, clockMs]);

    useEffect(
        () => () => {
            if (debounce.current !== null) clearTimeout(debounce.current);
        },
        [],
    );

    function refreshNow() {
        setRefreshing(true);
        router.refresh();
        if (debounce.current !== null) clearTimeout(debounce.current);
        debounce.current = window.setTimeout(() => {
            setRefreshing(false);
            debounce.current = null;
        }, 600);
    }

    return { now, refreshing, refreshNow };
}
