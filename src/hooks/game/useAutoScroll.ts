"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Pass the feed array itself as `dep` so the effect runs each time it grows —
 * an unused dep would be stripped and the effect would only run once on mount.
 */
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
