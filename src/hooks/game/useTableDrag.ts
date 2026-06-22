"use client";

import {
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import type { CardDescriptor } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import type { TableCardItem } from "@/lib/games/table/types";

/** Vertical gap between cards in a dragged run clone (px), matching cascades. */
export const CLONE_OFFSET = 14;

/** One card rendered in the floating drag clone. */
export interface DragStackCard {
    readonly id: string;
    readonly card: CardDescriptor;
    readonly ownerId?: string;
}

/** Live drag: which cards left the board, the clone, and where it may land. */
export interface DragState {
    /** Source-card ids hidden while the clone is in flight. */
    readonly hiddenIds: readonly string[];
    /** The cards drawn in the floating clone (top-to-bottom). */
    readonly stack: readonly DragStackCard[];
    /** Legal drops, by destination zone key. */
    readonly targets: ReadonlyArray<{
        readonly zoneKey: string;
        readonly action: GameAction;
    }>;
    /** Clone top-left in viewport px. */
    readonly x: number;
    readonly y: number;
    /** Grab point inside the card, so the clone tracks the cursor naturally. */
    readonly offsetX: number;
    readonly offsetY: number;
    readonly cardW: number;
    readonly cardH: number;
}

interface DragOptions {
    onAction: (action: GameAction) => void;
    pending: boolean;
    /** The board surface — the clone is clamped inside it. */
    boundsRef: RefObject<HTMLElement | null>;
}

function hitTest(
    x: number,
    y: number,
    targets: DragState["targets"],
): DragState["targets"][number] | null {
    // The clone is `pointer-events: none`, so it never occludes the board.
    const zoneEl = document.elementFromPoint(x, y)?.closest("[data-zone-key]");
    const key = zoneEl?.getAttribute("data-zone-key");
    if (!key) return null;
    return targets.find((t) => t.zoneKey === key) ?? null;
}

export function useTableDrag({ onAction, pending, boundsRef }: DragOptions): {
    dragging: DragState | null;
    beginDrag: (
        item: TableCardItem,
        clientX: number,
        clientY: number,
        rect: DOMRect,
    ) => void;
} {
    const [dragging, setDragging] = useState<DragState | null>(null);

    // Latest values for the window listeners without re-binding them each move.
    const stateRef = useRef(dragging);
    stateRef.current = dragging;
    const cfg = useRef({ onAction, pending });
    cfg.current = { onAction, pending };

    const beginDrag = useCallback(
        (
            item: TableCardItem,
            clientX: number,
            clientY: number,
            rect: DOMRect,
        ) => {
            if (cfg.current.pending || !item.dropTargets?.length) return;
            const stack: DragStackCard[] = item.dragStack
                ? [...item.dragStack]
                : [{ id: item.id, card: item.card, ownerId: item.ownerId }];
            setDragging({
                hiddenIds: stack.map((s) => s.id),
                stack,
                targets: item.dropTargets,
                offsetX: clientX - rect.left,
                offsetY: clientY - rect.top,
                x: rect.left,
                y: rect.top,
                cardW: rect.width,
                cardH: rect.height,
            });
        },
        [],
    );

    const active = dragging !== null;
    useEffect(() => {
        if (!active) return;

        const move = (e: PointerEvent) => {
            e.preventDefault();
            setDragging((d) => {
                if (!d) return d;
                let x = e.clientX - d.offsetX;
                let y = e.clientY - d.offsetY;
                const b = boundsRef.current?.getBoundingClientRect();
                if (b) {
                    const stackH =
                        d.cardH + (d.stack.length - 1) * CLONE_OFFSET;
                    x = Math.max(b.left, Math.min(x, b.right - d.cardW));
                    y = Math.max(b.top, Math.min(y, b.bottom - stackH));
                }
                return { ...d, x, y };
            });
        };
        const drop = (e: PointerEvent) => {
            const d = stateRef.current;
            setDragging(null);
            if (!d || cfg.current.pending) return;
            const target = hitTest(e.clientX, e.clientY, d.targets);
            if (target) cfg.current.onAction(target.action);
        };

        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", drop);
        window.addEventListener("pointercancel", drop);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", drop);
            window.removeEventListener("pointercancel", drop);
        };
    }, [active, boundsRef]);

    return { dragging, beginDrag };
}
