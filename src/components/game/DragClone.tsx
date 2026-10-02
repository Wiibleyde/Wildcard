"use client";

import type { RefObject } from "react";
import { Card } from "@/components/card/Card";
import {
    CLONE_OFFSET,
    cloneTransform,
    type DragState,
} from "@/hooks/game/useTableDrag";
import type { CardTheme } from "@/lib/card/types";

// Fixed to the viewport so the board's overflow can't clip it; moved by
// `useTableDrag` through `cloneRef`.
export function DragClone({
    dragging,
    cloneRef,
    themeFor,
}: {
    dragging: DragState;
    cloneRef: RefObject<HTMLDivElement | null>;
    themeFor: (ownerId: string | undefined) => CardTheme;
}) {
    return (
        <div
            ref={cloneRef}
            className="pointer-events-none fixed top-0 left-0 z-9999 will-change-transform"
            style={{
                transform: cloneTransform(dragging.originX, dragging.originY),
            }}
        >
            {dragging.stack.map((s, i) => (
                <div
                    key={s.id}
                    className="absolute"
                    style={{
                        top: i * CLONE_OFFSET,
                        left: 0,
                        width: dragging.cardW,
                        transform: "rotate(2deg)",
                        filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.4))",
                    }}
                >
                    <Card card={s.card} theme={themeFor(s.ownerId)} />
                </div>
            ))}
        </div>
    );
}
