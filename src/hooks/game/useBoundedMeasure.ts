"use client";

import { type DependencyList, type RefObject, useEffect, useRef } from "react";

/** The `lg:` breakpoint — the board becomes height-bounded at this width. */
export const BOUNDED_MQ = "(min-width: 1024px)";

/**
 * Re-runs the caller's `measure` on mount, on every ResizeObserver tick, and on
 * `lg:` breakpoint flip. `extraTargets` are observed too, so a card re-measures
 * when its container resizes.
 */
export function useBoundedMeasure<T extends HTMLElement>(
    ref: RefObject<T | null>,
    measure: () => void,
    deps: DependencyList,
    extraTargets?: (el: T) => Iterable<HTMLElement | null>,
): void {
    // `measure`/`extraTargets` are fresh closures each render; read them through
    // refs so the effect only re-subscribes when the caller's `deps` change.
    const measureRef = useRef(measure);
    measureRef.current = measure;
    const extraRef = useRef(extraTargets);
    extraRef.current = extraTargets;

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const run = () => measureRef.current();
        run();
        const ro = new ResizeObserver(run);
        ro.observe(el);
        const extra = extraRef.current;
        if (extra) {
            for (const target of extra(el)) {
                if (target) ro.observe(target);
            }
        }
        const mq = window.matchMedia(BOUNDED_MQ);
        mq.addEventListener("change", run);
        return () => {
            ro.disconnect();
            mq.removeEventListener("change", run);
        };
        // The caller's `deps` drive re-subscription; `ref` is stable.
    }, [ref, ...deps]);
}
