"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameAction } from "@/lib/engine/types";
import type { TableCardItem, TableData } from "@/lib/games/table/types";
import type { BeginDrag } from "./useTableDrag";

/** Max pointer travel (px) between down and up still counted as a tap. */
const TAP_SLOP = 6;

export interface ClickSelection {
    readonly id: string;
    readonly card: TableCardItem;
    readonly targets: NonNullable<TableCardItem["dropTargets"]>;
}

/**
 * Pointer-free path to every drag move (keyboard, screen reader, tap): pick a
 * draggable card up, then press one of its highlighted destinations.
 */
export function useClickToMove(
    data: TableData,
    pending: boolean,
    onAction: (action: GameAction) => void,
    beginDrag: BeginDrag,
) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selection: ClickSelection | null = useMemo(() => {
        if (selectedId === null || pending) return null;
        for (const zone of data.zones) {
            const item = zone.cards.find((c) => c.id === selectedId);
            if (item?.dropTargets?.length) {
                return { id: item.id, card: item, targets: item.dropTargets };
            }
        }
        return null;
    }, [selectedId, pending, data]);

    const toggleSelect = useCallback((item: TableCardItem) => {
        setSelectedId((prev) => (prev === item.id ? null : item.id));
    }, []);
    const moveSelected = useCallback(
        (action: GameAction) => {
            setSelectedId(null);
            onAction(action);
        },
        [onAction],
    );

    const hasSelection = selection !== null;
    useEffect(() => {
        if (!hasSelection) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedId(null);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [hasSelection]);

    // A drag that never moved is a tap. Detected on pointerup rather than the
    // card's click: the source card hides as the drag starts, so the click
    // lands on whatever is underneath.
    const tapRef = useRef<{ item: TableCardItem; x: number; y: number } | null>(
        null,
    );
    const beginDragOrTap: BeginDrag = useCallback(
        (item, x, y, rect) => {
            tapRef.current = { item, x, y };
            beginDrag(item, x, y, rect);
        },
        [beginDrag],
    );
    useEffect(() => {
        const end = (e: PointerEvent) => {
            const tap = tapRef.current;
            tapRef.current = null;
            if (!tap || e.type !== "pointerup") return;
            if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= TAP_SLOP) {
                toggleSelect(tap.item);
            }
        };
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        return () => {
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
        };
    }, [toggleSelect]);

    return { selection, toggleSelect, moveSelected, beginDragOrTap };
}
