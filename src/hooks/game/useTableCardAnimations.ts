"use client";

import { type RefObject, useCallback, useRef } from "react";
import { getPlayAnimation, prefersReducedMotion } from "@/lib/card/animations";
import type { CardTheme } from "@/lib/card/types";
import type { TableData } from "@/lib/games/table/types";
import { useGSAP } from "@/lib/gsap";

type CardRef = (el: HTMLDivElement | null) => void;

interface TableCardAnimations {
    rootRef: RefObject<HTMLDivElement | null>;
    registerCard: (id: string) => CardRef;
}

/**
 * Plays the deck's landing animation for cards that appear on the table.
 * Cards present at mount (page load, reconnect, replay seek) don't animate.
 */
export function useTableCardAnimations(
    data: TableData,
    themeFor: (ownerId: string | undefined) => CardTheme,
    currentUserId: string,
): TableCardAnimations {
    const rootRef = useRef<HTMLDivElement>(null);
    const cardEls = useRef(new Map<string, HTMLDivElement>());
    // One stable callback per id, so React doesn't detach/reattach every ref each render.
    const cardRefs = useRef(new Map<string, CardRef>());
    const shownIds = useRef<Set<string> | null>(null);

    useGSAP(
        () => {
            const ids = new Set(
                data.zones.flatMap((zone) => zone.cards.map((c) => c.id)),
            );
            const previous = shownIds.current;
            // Only the current table is kept: a card that leaves and later
            // comes back lands again.
            shownIds.current = ids;
            for (const id of cardRefs.current.keys()) {
                if (!ids.has(id)) cardRefs.current.delete(id);
            }
            if (previous === null || prefersReducedMotion()) return;

            for (const zone of data.zones) {
                for (const item of zone.cards) {
                    if (previous.has(item.id)) continue;
                    const el = cardEls.current.get(item.id);
                    if (!el) continue;
                    const theme = themeFor(item.ownerId);
                    getPlayAnimation(theme.playAnimation).animate(el, {
                        origin:
                            (item.ownerId ?? currentUserId) === currentUserId
                                ? "self"
                                : "opponent",
                        duration: theme.playAnimation?.duration,
                    });
                }
            }
        },
        { dependencies: [data], scope: rootRef },
    );

    const registerCard = useCallback((id: string) => {
        let ref = cardRefs.current.get(id);
        if (!ref) {
            ref = (el) => {
                if (el) cardEls.current.set(id, el);
                else cardEls.current.delete(id);
            };
            cardRefs.current.set(id, ref);
        }
        return ref;
    }, []);

    return { rootRef, registerCard };
}
