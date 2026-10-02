"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";

type Options = {
    refreshMs: number;
    clockMs?: number;
};

/**
 * Polls `router.refresh()` and ticks a clock for relative times. `now` stays
 * `null` through SSR and hydration: a server timestamp would never match the client's.
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
