"use client";

import { type DependencyList, type RefObject, useEffect, useRef } from "react";

/** From `lg:` the board is height-bounded. */
export const BOUNDED_MQ = "(min-width: 1024px)";

/** Runs `measure` on mount, on resize of `ref` / `extraTargets`, and on the `lg:` flip. */
export function useBoundedMeasure<T extends HTMLElement>(
    ref: RefObject<T | null>,
    measure: () => void,
    deps: DependencyList,
    extraTargets?: (el: T) => Iterable<HTMLElement | null>,
): void {
    // Fresh closures each render: read through refs so only `deps` re-subscribe.
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
    }, [ref, ...deps]);
}
