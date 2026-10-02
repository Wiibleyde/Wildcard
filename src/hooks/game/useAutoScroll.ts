"use client";

import { type RefObject, useEffect, useRef } from "react";

// `dep` is the feed itself, so the effect re-runs each time it grows.
export function useAutoScroll<T extends HTMLElement>(
    dep: unknown,
): RefObject<T | null> {
    const ref = useRef<T>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: `dep` is the intended trigger
    useEffect(() => {
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [dep]);

    return ref;
}
