"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
    );
}

/** Focuses the container itself (a destructive default stays one Tab away, not one Enter), cycles Tab inside, restores the opener on close. */
export function useFocusTrap(
    active: boolean,
    containerRef: RefObject<HTMLElement | null>,
): void {
    useEffect(() => {
        if (!active) return;
        const opener =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        containerRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            const root = containerRef.current;
            if (e.key !== "Tab" || !root) return;
            const items = focusablesIn(root);
            if (items.length === 0) {
                e.preventDefault();
                root.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            const current = document.activeElement;
            const inside = current instanceof Node && root.contains(current);
            if (
                e.shiftKey &&
                (!inside || current === first || current === root)
            ) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (!inside || current === last)) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            if (opener?.isConnected) opener.focus();
        };
    }, [active, containerRef]);
}
