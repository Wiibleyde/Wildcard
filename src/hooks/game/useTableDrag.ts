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

/** Vertical gap (px) between cards of a dragged run, matching cascades. */
export const CLONE_OFFSET = 14;

export interface DragStackCard {
    readonly id: string;
    readonly card: CardDescriptor;
    readonly ownerId?: string;
}

// Only what changes once per drag lives in state; the per-frame clone
// position is written straight to the DOM so zones don't re-render at 60fps.
export interface DragState {
    readonly hiddenIds: readonly string[];
    readonly stack: readonly DragStackCard[];
    readonly targets: ReadonlyArray<{
        readonly zoneKey: string;
        readonly action: GameAction;
    }>;
    readonly originX: number;
    readonly originY: number;
    readonly cardW: number;
    readonly cardH: number;
}

export type BeginDrag = (
    item: TableCardItem,
    clientX: number,
    clientY: number,
    rect: DOMRect,
) => void;

interface DragOptions {
    onAction: (action: GameAction) => void;
    pending: boolean;
    /** The clone is clamped inside this element. */
    boundsRef: RefObject<HTMLElement | null>;
}

export function cloneTransform(x: number, y: number): string {
    return `translate3d(${x}px, ${y}px, 0)`;
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
    beginDrag: BeginDrag;
    cloneRef: RefObject<HTMLDivElement | null>;
} {
    const [dragging, setDragging] = useState<DragState | null>(null);
    const cloneRef = useRef<HTMLDivElement>(null);
    const grabRef = useRef({ x: 0, y: 0 });

    // Latest values for the window listeners without re-binding them.
    const stateRef = useRef(dragging);
    stateRef.current = dragging;
    const cfg = useRef({ onAction, pending });
    cfg.current = { onAction, pending };

    const beginDrag: BeginDrag = useCallback((item, clientX, clientY, rect) => {
        if (cfg.current.pending || !item.dropTargets?.length) return;
        const stack: DragStackCard[] = item.dragStack
            ? [...item.dragStack]
            : [{ id: item.id, card: item.card, ownerId: item.ownerId }];
        grabRef.current = { x: clientX - rect.left, y: clientY - rect.top };
        setDragging({
            hiddenIds: stack.map((s) => s.id),
            stack,
            targets: item.dropTargets,
            originX: rect.left,
            originY: rect.top,
            cardW: rect.width,
            cardH: rect.height,
        });
    }, []);

    const active = dragging !== null;
    useEffect(() => {
        if (!active) return;

        const move = (e: PointerEvent) => {
            e.preventDefault();
            const d = stateRef.current;
            const el = cloneRef.current;
            if (!d || !el) return;
            let x = e.clientX - grabRef.current.x;
            let y = e.clientY - grabRef.current.y;
            const b = boundsRef.current?.getBoundingClientRect();
            if (b) {
                const stackH = d.cardH + (d.stack.length - 1) * CLONE_OFFSET;
                x = Math.max(b.left, Math.min(x, b.right - d.cardW));
                y = Math.max(b.top, Math.min(y, b.bottom - stackH));
            }
            el.style.transform = cloneTransform(x, y);
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

    return { dragging, beginDrag, cloneRef };
}
