"use client";

import { useGSAP } from "@gsap/react";
import { type RefObject, useCallback, useRef } from "react";
import { getPlayAnimation, prefersReducedMotion } from "@/lib/card/animations";
import type { CardTheme } from "@/lib/card/types";
import type { TableData } from "@/lib/games/table/types";

interface TableCardAnimations {
    rootRef: RefObject<HTMLDivElement | null>;
    registerCard: (id: string) => (el: HTMLDivElement | null) => void;
}

/**
 * Animated card ids are tracked so a re-render never re-plays a landing. The
 * cards already on the table at mount (page load, reconnect, replay seek) are
 * seeded as "seen": only cards that arrive afterwards animate in.
 */
export function useTableCardAnimations(
    data: TableData,
    themeFor: (ownerId: string | undefined) => CardTheme,
    currentUserId: string,
): TableCardAnimations {
    const rootRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef(new Map<string, HTMLDivElement>());
    const animatedIds = useRef<Set<string> | null>(null);

    useGSAP(
        () => {
            if (animatedIds.current === null) {
                animatedIds.current = new Set(
                    data.zones.flatMap((zone) =>
                        zone.cards.map((item) => item.id),
                    ),
                );
                return;
            }
            const seen = animatedIds.current;
            if (prefersReducedMotion()) return;
            for (const zone of data.zones) {
                for (const item of zone.cards) {
                    if (seen.has(item.id)) continue;
                    seen.add(item.id);
                    const el = cardRefs.current.get(item.id);
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

    const registerCard = useCallback(
        (id: string) => (el: HTMLDivElement | null) => {
            if (el) cardRefs.current.set(id, el);
            else cardRefs.current.delete(id);
        },
        [],
    );

    return { rootRef, registerCard };
}
