"use client";

import {
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Card } from "@/components/card/Card";
import { BoardPill } from "@/components/ui/BoardPill";
import { GameButton } from "@/components/ui/GameButton";
import { buildZoneStyle, tableTilt } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";
import { CARD_WIDTH_CLASS, type CardSize } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import type {
    TableCardItem,
    TableZoneInstance,
    TableZoneTemplate,
} from "@/lib/games/table/types";
import type { DragState } from "./useTableDrag";

/** Top cards a `stack` zone actually renders — the badge carries the rest. */
const STACK_VISIBLE = 3;

/** Render context shared by every zone of one table. */
export interface ZoneContext {
    boardTheme: BoardTheme;
    /** Block actions while one is in flight. */
    pending: boolean;
    /** Resolves a card owner's deck theme (viewer's own when no owner). */
    themeFor: (ownerId: string | undefined) => CardTheme;
    /** Ref registrar — lets the table run entry animations per card. */
    registerCard: (id: string) => (el: HTMLDivElement | null) => void;
    onAction: (action: GameAction) => void;
    /** Surface an "illegal move" notice when a blocked card is clicked. */
    onIllegal?: () => void;
    /** The in-flight drag, shared across every zone (`null` when idle). */
    dragging: DragState | null;
    /** Grab a card (and its run) to start a drag. */
    beginDrag: (
        item: TableCardItem,
        clientX: number,
        clientY: number,
        rect: DOMRect,
    ) => void;
}

interface TableZoneProps {
    instance: TableZoneInstance;
    template: TableZoneTemplate;
    ctx: ZoneContext;
}

/**
 * One zone instance: optional accent badge, the cards in the template's
 * arrangement (optionally framed in the themed panel), optional caption.
 */
export function TableZone({ instance, template, ctx }: TableZoneProps) {
    // A drop target when the in-flight drag lists this zone's key. `data-zone-key`
    // lets the drag controller hit-test the pointer against this element.
    const isDropTarget =
        ctx.dragging?.targets.some((t) => t.zoneKey === instance.key) ?? false;

    // Whole-zone click affordance (e.g. the stock pile): fires even when empty.
    const zoneAction = instance.action;
    const onZoneClick =
        zoneAction && !ctx.pending ? () => ctx.onAction(zoneAction) : undefined;

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: pile click affordance — a zone with no single card to click (the stock pile draws/recycles); a mobile path is tracked separately.
        // biome-ignore lint/a11y/useKeyWithClickEvents: pile click affordance — keyboard play is served by the per-card actions; a dedicated a11y path is tracked separately.
        <div
            className={`flex flex-col items-center gap-1.5 ${
                template.fill ? "min-w-0 flex-1" : ""
            }`}
            data-zone-key={instance.key}
            style={{
                cursor: onZoneClick ? "pointer" : undefined,
                ...(isDropTarget
                    ? {
                          outline: `2px dashed ${ctx.boardTheme.accentColor}`,
                          outlineOffset: 4,
                          borderRadius: 12,
                      }
                    : null),
            }}
            onClick={onZoneClick}
        >
            {instance.badge && (
                <BoardPill theme={ctx.boardTheme} tone="accent">
                    {instance.badge}
                </BoardPill>
            )}
            {template.framed ? (
                <div
                    className="flex min-h-28 min-w-40 items-center justify-center rounded-xl px-4 py-3 sm:min-h-32 sm:min-w-48 sm:px-6 sm:py-4 xl:min-h-40 xl:min-w-60"
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
                    style={{ color: ctx.boardTheme.badge.textColor }}
                >
                    {instance.caption}
                </span>
            )}
        </div>
    );
}

/** Dispatches on the template's arrangement: fan, stack, cascade, or row. */
function ZoneCards({ instance, template, ctx }: TableZoneProps) {
    const size = template.cardSize ?? "md";

    if (instance.cards.length === 0) {
        return (
            <div
                className={`${template.fill ? "w-full" : CARD_WIDTH_CLASS[size]} flex aspect-[5/7] items-center justify-center rounded-md`}
                style={{ border: "1px dashed rgba(255,255,255,0.2)" }}
            >
                {instance.emptyHint && (
                    <span
                        className="px-1 text-center text-[10px] font-semibold xl:text-xs"
                        style={{
                            color: ctx.boardTheme.badge.textColor,
                            opacity: 0.5,
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
            <div className={`${CARD_WIDTH_CLASS[size]} relative aspect-[5/7]`}>
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
            <div
                className={`flex flex-col items-center ${
                    template.fill ? "w-full" : ""
                }`}
            >
                {instance.cards.map((item, i) => (
                    <ZoneCard
                        key={item.id}
                        item={item}
                        template={template}
                        ctx={ctx}
                        fill={template.fill}
                        // Each card overlaps the one above; a face-up parent
                        // peeks more (its rank stays readable) than a face-down
                        // one. Offsets are % of card width (height = 140%).
                        style={
                            i === 0
                                ? undefined
                                : {
                                      marginTop: instance.cards[i - 1].faceDown
                                          ? "-122%"
                                          : "-96%",
                                  }
                        }
                    />
                ))}
            </div>
        );
    }

    // "row" — side by side with a light overlap and a thrown-card tilt.
    return (
        <div className="flex items-center justify-center">
            {instance.cards.map((item, i) => (
                <div
                    key={item.id}
                    style={{
                        marginLeft: i === 0 ? 0 : "-1.4rem",
                        transform: `rotate(${tableTilt(item.id)}deg)`,
                    }}
                >
                    <ZoneCard item={item} template={template} ctx={ctx} />
                </div>
            ))}
        </div>
    );
}

/** Mobile-base card widths (px), used as the pre-measure overlap estimate so
 * the fan paints at a sensible overlap before the ResizeObserver kicks in. */
const CARD_PX_ESTIMATE: Record<CardSize, number> = {
    xs: 48,
    sm: 48,
    md: 80,
    lg: 96,
    xl: 128,
};

const DEG = Math.PI / 180;
/** Whole-fan half-angle ceiling and the max tilt between two neighbours. */
const FAN_MAX_HALF = 28 * DEG;
const FAN_MAX_STEP = 7 * DEG;
/** How far a selected card lifts out of the fan (px). */
const SELECT_LIFT = 26;

/**
 * The viewer's hand as a single-pivot arc fan: every card rotates about one
 * shared point well below the row, so the spread stays even and reads like a
 * real hand at any count. The fan is both angle-bounded and width-fitted, so
 * it never scrolls or overflows from mobile (375px) to 2K.
 *
 * With a {@link HandSelection} the hand becomes a combo picker: tap cards of
 * one group (e.g. same rank) to select them — the fan lifts each — and once
 * the picked set matches a legal play the commit button arms and lays it.
 * Without it, cards simply dispatch their own `action` on click.
 */
function HandFan({ instance, template, ctx }: TableZoneProps) {
    const size = template.cardSize ?? "md";
    const cards = instance.cards;
    const n = cards.length;
    const selection = instance.selection ?? null;

    const rowRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState(() => {
        const cardW = CARD_PX_ESTIMATE[size];
        return { cardW, cardH: cardW * 1.4, avail: 9999 };
    });
    const [picked, setPicked] = useState<readonly string[]>([]);

    // Measure in layout px — offset*/client* ignore the fan rotation, so the
    // geometry never compounds the tilt. Re-measure on resize (375px → 2K).
    useEffect(() => {
        const el = rowRef.current;
        if (!el) return;
        const measure = () => {
            const first = el.querySelector<HTMLElement>("[data-fan-card]");
            const cardW = first?.offsetWidth || CARD_PX_ESTIMATE[size];
            const cardH = first?.offsetHeight || cardW * 1.4;
            const avail = el.clientWidth;
            // A row of absolute-positioned cards can momentarily report a
            // collapsed width (its parent has no in-flow content to size to).
            // Never accept a width narrower than a single card — that would
            // flip the fan angle negative and stack every card behind the first.
            if (cardW > 0 && avail > cardW) setBox({ cardW, cardH, avail });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [size]);

    // A selection only holds for cards still in hand; committing a play (the
    // cards leave the hand) empties it on its own.
    const handIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);
    const sel = useMemo(
        () => (selection ? picked.filter((id) => handIds.has(id)) : []),
        [picked, handIds, selection],
    );
    useEffect(() => {
        if (sel.length !== picked.length) setPicked(sel);
    }, [sel, picked.length]);

    const groupOf = (id: string) => cards.find((c) => c.id === id)?.group;
    const selGroup = sel.length > 0 ? groupOf(sel[0]) : undefined;
    const armed =
        selection && selGroup
            ? (selection.plays.find(
                  (p) => p.group === selGroup && p.count === sel.length,
              ) ?? null)
            : null;

    const toggle = (item: TableCardItem) => {
        if (!item.group) {
            ctx.onIllegal?.();
            return;
        }
        setPicked((prev) => {
            const cur = prev.filter((id) => handIds.has(id));
            if (cur.includes(item.id))
                return cur.filter((id) => id !== item.id);
            // A card from another group starts a fresh pick — one combo at a time.
            if (cur.length > 0 && groupOf(cur[0]) !== item.group)
                return [item.id];
            return [...cur, item.id];
        });
    };

    const commit = () => {
        if (!armed) return;
        ctx.onAction(armed.action);
        setPicked([]);
    };

    const clickFor = (item: TableCardItem): (() => void) | undefined => {
        if (ctx.pending) return undefined;
        if (selection)
            return item.group || item.illegal ? () => toggle(item) : undefined;
        if (item.action) {
            const a = item.action;
            return () => ctx.onAction(a);
        }
        if (item.illegal) return () => ctx.onIllegal?.();
        return undefined;
    };

    // ── Geometry: one pivot below the row, even angular steps both bounded ──
    const mid = (n - 1) / 2;
    const pivotY = box.cardH + box.cardW * 1.6; // pivot depth from the card top
    const rho = pivotY - box.cardH / 2; // pivot → card centre
    const fitHalf =
        n > 1 ? Math.asin(Math.min(1, (box.avail - box.cardW) / (2 * rho))) : 0;
    const stepRad =
        n > 1
            ? Math.min(
                  (2 * Math.min(FAN_MAX_HALF, fitHalf)) / (n - 1),
                  FAN_MAX_STEP,
              )
            : 0;

    return (
        <div className="flex w-full flex-col items-center gap-2">
            {/* Reserve the commit row whenever the hand is a picker, so the
                fan never jumps the moment the first card is selected. */}
            {selection && (
                <div className="flex h-9 items-center justify-center">
                    {sel.length > 0 && (
                        <GameButton
                            size="sm"
                            variant="green"
                            disabled={!armed || ctx.pending}
                            onClick={commit}
                        >
                            {selection.playLabel}
                            {sel.length > 1 ? ` ×${sel.length}` : ""}
                        </GameButton>
                    )}
                </div>
            )}
            <div
                ref={rowRef}
                className="relative w-full"
                style={{ height: box.cardH + SELECT_LIFT + 8 }}
            >
                {cards.map((item, i) => {
                    const deg = ((i - mid) * stepRad) / DEG;
                    const isSel = sel.includes(item.id);
                    return (
                        <div
                            key={item.id}
                            data-fan-card
                            className={`${CARD_WIDTH_CLASS[size]} absolute bottom-0 left-1/2 transition-transform duration-150`}
                            style={{
                                transformOrigin: `50% ${pivotY}px`,
                                transform: `translateY(${
                                    isSel ? -SELECT_LIFT : 0
                                }px) translateX(-50%) rotate(${deg}deg)`,
                                // Keep the natural left-to-right stacking — a
                                // selected card only lifts, it never jumps above
                                // its neighbours.
                                zIndex: i,
                            }}
                        >
                            <div
                                ref={ctx.registerCard(item.id)}
                                className="w-full will-change-transform"
                            >
                                <Card
                                    card={item.card}
                                    faceDown={item.faceDown}
                                    theme={ctx.themeFor(item.ownerId)}
                                    disableTransitions
                                    onClick={clickFor(item)}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ZoneCard({
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

    // Draggable when the game gave it destinations and nothing's in flight.
    const draggable = !ctx.pending && (dropTargets?.length ?? 0) > 0;
    // While in flight the source cards lift out — the floating clone stands in.
    const isHidden = ctx.dragging?.hiddenIds.includes(item.id) ?? false;

    // Draggable cards keep single-click free for grabbing; their `action` is the
    // double-click auto-move. Non-draggable cards play on a single click (and a
    // blocked card explains itself). Everything is inert while an action lands.
    const onClick =
        ctx.pending || draggable
            ? undefined
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
              // No preventDefault: it can swallow the compatibility dblclick in
              // some browsers (the auto-move). `touch-action: none` already stops
              // touch scrolling; cards are `select-none` so no text selection.
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
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer drag source — draggable cards expose a double-click auto-move for non-pointer play; a mobile path is tracked separately.
        <div
            ref={ctx.registerCard(item.id)}
            className={`${width} will-change-transform`}
            style={{
                ...style,
                visibility: isHidden ? "hidden" : undefined,
                touchAction: draggable ? "none" : undefined,
                cursor: draggable ? "grab" : undefined,
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
            />
        </div>
    );
}
