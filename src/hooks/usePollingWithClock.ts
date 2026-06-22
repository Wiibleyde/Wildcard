"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Options = {
    refreshMs: number;
    clockMs?: number;
};

/**
 * Ticks a clock so relative timestamps stay fresh without re-fetching, and
 * polls `router.refresh()` on an interval. `refreshNow` flips `refreshing` for
 * ~600ms to debounce the UI.
 */
export function usePollingWithClock({ refreshMs, clockMs = 1000 }: Options) {
    const router = useRouter();
    const [now, setNow] = useState(() => Date.now());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const clock = setInterval(() => setNow(Date.now()), clockMs);
        const poll = setInterval(() => router.refresh(), refreshMs);
        return () => {
            clearInterval(clock);
            clearInterval(poll);
        };
    }, [router, refreshMs, clockMs]);

    function refreshNow() {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 600);
    }

    return { now, refreshing, refreshNow };
}
