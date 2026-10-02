"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Card } from "@/components/card/Card";
import type { ClickSelection } from "@/hooks/game/useClickToMove";
import type { BeginDrag, DragState } from "@/hooks/game/useTableDrag";
import type { BoardTheme } from "@/lib/board/types";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import type {
    TableCardItem,
    TableZoneInstance,
    TableZoneTemplate,
} from "@/lib/games/table/types";

export interface ZoneContext {
    boardTheme: BoardTheme;
    pending: boolean;
    themeFor: (ownerId: string | undefined) => CardTheme;
    registerCard: (id: string) => (el: HTMLDivElement | null) => void;
    onAction: (action: GameAction) => void;
    onIllegal?: () => void;
    dragging: DragState | null;
    beginDrag: BeginDrag;
    selection: ClickSelection | null;
    toggleSelect: (item: TableCardItem) => void;
    moveSelected: (action: GameAction) => void;
}

export interface TableZoneProps {
    instance: TableZoneInstance;
    template: TableZoneTemplate;
    ctx: ZoneContext;
}

/** Combo-picking hand: the click toggles the pick instead of playing. */
export interface CardPick {
    readonly selected: boolean;
    readonly onToggle?: () => void;
}

export function ZoneCard({
    item,
    template,
    ctx,
    style,
    fill = false,
    pick,
}: {
    item: TableCardItem;
    template: TableZoneTemplate;
    ctx: ZoneContext;
    style?: CSSProperties;
    /** Fill the parent instead of sizing from the template. */
    fill?: boolean;
    pick?: CardPick;
}) {
    const { action, dropTargets } = item;
    const width = fill ? "w-full" : CARD_WIDTH_CLASS[template.cardSize ?? "md"];

    const draggable = !ctx.pending && (dropTargets?.length ?? 0) > 0;
    const isHidden = ctx.dragging?.hiddenIds.includes(item.id) ?? false;
    const isSelected = ctx.selection?.id === item.id;

    // Draggable cards leave pointer taps to the table's tap detector; only
    // keyboard activation (`detail === 0`) picks them up here.
    const onClick = ctx.pending
        ? undefined
        : pick
          ? pick.onToggle
          : draggable
            ? (e: { detail: number }) => {
                  if (e.detail === 0) ctx.toggleSelect(item);
              }
            : action !== undefined
              ? () => ctx.onAction(action)
              : item.illegal
                ? () => ctx.onIllegal?.()
                : undefined;
    const onDoubleClick =
        draggable && action !== undefined
            ? () => ctx.onAction(action)
            : undefined;

    const onPointerDown = draggable
        ? (e: ReactPointerEvent<HTMLDivElement>) => {
              // No preventDefault: it can swallow the compatibility dblclick (auto-move).
              if (e.button !== 0 && e.pointerType === "mouse") return;
              ctx.beginDrag(
                  item,
                  e.clientX,
                  e.clientY,
                  e.currentTarget.getBoundingClientRect(),
              );
          }
        : undefined;

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer drag source — the inner card <button> carries the keyboard/AT path (pick up, then a destination button).
        <div
            ref={ctx.registerCard(item.id)}
            className={`${width} will-change-transform`}
            style={{
                ...style,
                visibility: isHidden ? "hidden" : undefined,
                touchAction: draggable ? "none" : undefined,
                cursor: draggable ? "grab" : undefined,
                ...(isSelected
                    ? {
                          outline: `3px solid ${ctx.boardTheme.accentColor}`,
                          outlineOffset: 2,
                          borderRadius: 8,
                      }
                    : null),
            }}
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
        >
            <Card
                card={item.card}
                faceDown={item.faceDown}
                theme={ctx.themeFor(item.ownerId)}
                onClick={onClick}
                pressed={
                    pick ? pick.selected : draggable ? isSelected : undefined
                }
            />
        </div>
    );
}
