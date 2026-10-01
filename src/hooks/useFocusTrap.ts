"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
    );
}

/**
 * Modal focus management: while `active`, focus moves into `containerRef`
 * (the container itself, so a destructive default isn't one stray Enter away),
 * Tab / Shift+Tab cycle inside it, and on deactivation focus returns to the
 * element that opened the modal.
 */
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
