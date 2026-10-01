"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Card, useCardLabel } from "@/components/card/Card";
import { BoardPill } from "@/components/ui/BoardPill";
import type { DragState } from "@/hooks/game/useTableDrag";
import { buildZoneStyle } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";
import { CARD_WIDTH_CLASS, type CardSize } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import type {
    TableCardItem,
    TableZoneInstance,
    TableZoneTemplate,
} from "@/lib/games/table/types";
import { CardRow } from "./zones/CardRow";
import { CascadeColumn } from "./zones/CascadeColumn";
import { HandFan } from "./zones/HandFan";

/** Top cards a `stack` zone actually renders — the badge carries the rest. */
const STACK_VISIBLE = 3;

export interface ZoneContext {
    boardTheme: BoardTheme;
    pending: boolean;
    /** Resolves a card owner's deck theme (viewer's own when no owner). */
    themeFor: (ownerId: string | undefined) => CardTheme;
    registerCard: (id: string) => (el: HTMLDivElement | null) => void;
    onAction: (action: GameAction) => void;
    onIllegal?: () => void;
    /** The in-flight drag, shared across every zone (`null` when idle). */
    dragging: DragState | null;
    beginDrag: (
        item: TableCardItem,
        clientX: number,
        clientY: number,
        rect: DOMRect,
    ) => void;
    /**
     * Click-to-move path (keyboard, screen reader, tap): the picked-up card
     * and its legal destinations, or `null`. Mirrors a drag without a pointer.
     */
    selection: {
        readonly id: string;
        readonly targets: NonNullable<TableCardItem["dropTargets"]>;
    } | null;
    /** Pick up / put back a draggable card (keyboard activation). */
    toggleSelect: (item: TableCardItem) => void;
    /** Drop the picked-up card on a destination. */
    moveSelected: (action: GameAction) => void;
}

export interface TableZoneProps {
    instance: TableZoneInstance;
    template: TableZoneTemplate;
    ctx: ZoneContext;
}

export function TableZone({ instance, template, ctx }: TableZoneProps) {
    const t = useTranslations("game");
    const labelOf = useCardLabel();
    // `data-zone-key` lets the drag controller hit-test the pointer against this element.
    const isDropTarget =
        ctx.dragging?.targets.some((d) => d.zoneKey === instance.key) ?? false;
    const moveTarget =
        ctx.selection?.targets.find((d) => d.zoneKey === instance.key) ?? null;

    const zoneAction = instance.action;
    const onZoneClick =
        zoneAction && !ctx.pending ? () => ctx.onAction(zoneAction) : undefined;
    // A pile with no clickable card of its own (the stock) gets a real button
    // layered over it — keyboard-reachable and named. If its cards are
    // interactive themselves, keep the pointer-only wrapper click so the
    // overlay doesn't swallow them.
    const cardsInteractive = instance.cards.some(
        (c) =>
            c.action !== undefined ||
            c.illegal === true ||
            (c.dropTargets?.length ?? 0) > 0,
    );
    const zoneButton = onZoneClick !== undefined && !cardsInteractive;

    const top = instance.cards.at(-1);
    const zoneLabel = top
        ? labelOf(top.card, top.faceDown)
        : (instance.caption ?? instance.emptyHint ?? instance.key);
    const highlighted = isDropTarget || moveTarget !== null;

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut only when the pile's own cards are interactive — otherwise the overlay <button> below carries the action for keyboard/AT.
        // biome-ignore lint/a11y/useKeyWithClickEvents: see above — the keyboard path is the per-card buttons or the zone overlay button.
        <div
            className={`relative flex flex-col items-center gap-1.5 ${
                template.fill
                    ? "min-w-0 max-w-32 flex-1 lg:h-full lg:min-h-0"
                    : ""
            } ${
                template.arrangement === "fan"
                    ? "w-full lg:h-full lg:min-h-0"
                    : ""
            }`}
            data-zone-key={instance.key}
            style={{
                cursor: onZoneClick ? "pointer" : undefined,
                ...(highlighted
                    ? {
                          outline: `2px dashed ${ctx.boardTheme.accentColor}`,
                          outlineOffset: 4,
                          borderRadius: 12,
                      }
                    : null),
            }}
            onClick={zoneButton || moveTarget ? undefined : onZoneClick}
        >
            {instance.badge && (
                <BoardPill theme={ctx.boardTheme} tone="accent">
                    {instance.badge}
                </BoardPill>
            )}
            {template.framed ? (
                <div
                    className="flex min-h-28 min-w-40 max-w-full items-center justify-center rounded-xl px-4 py-3 sm:min-h-32 sm:min-w-48 sm:px-6 sm:py-4 lg:max-h-full lg:min-h-0 xl:min-w-60"
                    style={buildZoneStyle(ctx.boardTheme)}
                >
                    <ZoneCards
                        instance={instance}
                        template={template}
                        ctx={ctx}
                    />
                </div>
            ) : (
                <ZoneCards instance={instance} template={template} ctx={ctx} />
            )}
            {instance.caption && (
                <span
                    className="text-xs font-bold xl:text-sm"
                    style={{ color: ctx.boardTheme.zone.textColor }}
                >
                    {instance.caption}
                </span>
            )}
            {moveTarget ? (
                <button
                    type="button"
                    className="absolute inset-0 z-20 cursor-pointer rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2"
                    style={{ outlineColor: ctx.boardTheme.accentColor }}
                    aria-label={t("move_here", { target: zoneLabel })}
                    onClick={() => ctx.moveSelected(moveTarget.action)}
                />
            ) : (
                zoneButton && (
                    <button
                        type="button"
                        className="absolute inset-0 z-20 cursor-pointer rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2"
                        style={{ outlineColor: ctx.boardTheme.accentColor }}
                        aria-label={t("zone_activate", {
                            label:
                                instance.cards.length === 0
                                    ? (instance.emptyHint ?? zoneLabel)
                                    : (instance.caption ?? zoneLabel),
                        })}
                        onClick={onZoneClick}
                    />
                )
            )}
        </div>
    );
}

function ZoneCards({ instance, template, ctx }: TableZoneProps) {
    const size = template.cardSize ?? "md";

    if (instance.cards.length === 0) {
        return (
            <div
                className={`${template.fill ? "w-full" : CARD_WIDTH_CLASS[size]} flex aspect-5/7 items-center justify-center rounded-md`}
                style={{ border: "1px dashed rgba(255,255,255,0.2)" }}
            >
                {instance.emptyHint && (
                    <span
                        className="px-1 text-center text-wc-label font-semibold xl:text-xs"
                        style={{
                            color: ctx.boardTheme.zone.textColor,
                            opacity: 0.6,
                        }}
                    >
                        {instance.emptyHint}
                    </span>
                )}
            </div>
        );
    }

    if (template.arrangement === "fan") {
        return <HandFan instance={instance} template={template} ctx={ctx} />;
    }

    if (template.arrangement === "stack") {
        const top = instance.cards.slice(-STACK_VISIBLE);
        return (
            <div className={`${CARD_WIDTH_CLASS[size]} relative aspect-5/7`}>
                {top.map((item, i) => (
                    <div
                        key={item.id}
                        className="absolute inset-0"
                        style={{
                            transform: `translateY(${(i - top.length + 1) * 4}px)`,
                        }}
                    >
                        <ZoneCard
                            item={item}
                            template={template}
                            ctx={ctx}
                            fill
                        />
                    </div>
                ))}
            </div>
        );
    }

    if (template.arrangement === "cascade") {
        return (
            <CascadeColumn instance={instance} template={template} ctx={ctx} />
        );
    }

    return <CardRow instance={instance} template={template} ctx={ctx} />;
}

/** Mobile-base card widths (px) — the overlap estimate used before the ResizeObserver measures. */
export const CARD_PX_ESTIMATE: Record<CardSize, number> = {
    xs: 48,
    sm: 48,
    md: 80,
    lg: 96,
    xl: 128,
};

export function ZoneCard({
    item,
    template,
    ctx,
    style,
    fill = false,
}: {
    item: TableCardItem;
    template: TableZoneTemplate;
    ctx: ZoneContext;
    style?: CSSProperties;
    /** Fill the parent instead of sizing from the template (stack layers). */
    fill?: boolean;
}) {
    const { action, dropTargets } = item;
    const width = fill ? "w-full" : CARD_WIDTH_CLASS[template.cardSize ?? "md"];

    const draggable = !ctx.pending && (dropTargets?.length ?? 0) > 0;
    const isHidden = ctx.dragging?.hiddenIds.includes(item.id) ?? false;
    const isSelected = ctx.selection?.id === item.id;

    // Draggable cards keep the pointer for grabbing (a tap picks them up via
    // the table's tap detector, double-click auto-moves). Keyboard activation
    // (`detail === 0`: Enter/Space) picks them up for the click-to-move path.
    const onClick = ctx.pending
        ? undefined
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
              // No preventDefault: it can swallow the compatibility dblclick (the auto-move). `touch-action: none` already stops touch scrolling; cards are `select-none`.
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
                disableTransitions={template.arrangement !== "fan"}
                onClick={onClick}
                pressed={draggable ? isSelected : undefined}
            />
        </div>
    );
}
