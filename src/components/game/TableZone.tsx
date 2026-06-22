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
                template.fill ? "min-w-0 flex-1 lg:h-full lg:min-h-0" : ""
            } ${
                template.arrangement === "fan"
                    ? "w-full lg:h-full lg:min-h-0"
                    : ""
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
                className={`${template.fill ? "w-full" : CARD_WIDTH_CLASS[size]} flex aspect-5/7 items-center justify-center rounded-md`}
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

    // "row" — side by side with a light overlap and a thrown-card tilt.
    return <CardRow instance={instance} template={template} ctx={ctx} />;
}

/** Natural peek (fraction of card width) a cascaded card shows above the next
 * one — face-up reveals its rank, face-down only a sliver. Card height = 140%
 * of its width, so a face-up card sits 96% of a width up, a face-down 122%. */
const CASCADE_PEEK = { up: 1.4 - 0.96, down: 1.4 - 1.22 };

/**
 * A vertical run (solitaire tableau). Each card overlaps the one above; the
 * board is height-bounded at `lg`, so a long column compresses its overlap to
 * fit instead of spilling off the felt. Below `lg` the page scrolls, so the
 * natural spacing is kept and the column can run as long as it likes.
 */
function CascadeColumn({ instance, template, ctx }: TableZoneProps) {
    const ref = useRef<HTMLDivElement>(null);
    const cards = instance.cards;
    // Compression factor applied to every gap (1 = natural, <1 = tightened).
    const [fit, setFit] = useState(1);

    // `instance.cards` is a fresh array on every render (mapView rebuilds it),
    // so it must NOT be an effect dependency — that would re-run the effect each
    // render and, with a state-setting ResizeObserver, loop forever. Read the
    // cards through a ref and key the effect on a stable face-down signature.
    const cardsRef = useRef(cards);
    cardsRef.current = cards;
    const faceKey = cards.map((c) => (c.faceDown ? "1" : "0")).join("");

    // `faceKey` re-measures when the column's length / face-down pattern
    // changes; `cards` itself is read via a ref to avoid a per-render loop.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional stable-signature trigger
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const cur = cardsRef.current;
            const bounded = window.matchMedia("(min-width: 1024px)").matches;
            if (!bounded || cur.length < 2) {
                setFit(1);
                return;
            }
            const first = el.querySelector<HTMLElement>("[data-cascade-card]");
            const cardW = first?.offsetWidth ?? 0;
            const cardH = first?.offsetHeight || cardW * 1.4;
            if (cardW <= 0) return;
            // Sum of the natural peeks of every card after the first.
            let peeks = 0;
            for (let i = 1; i < cur.length; i++)
                peeks +=
                    (cur[i - 1].faceDown
                        ? CASCADE_PEEK.down
                        : CASCADE_PEEK.up) * cardW;
            const room = el.clientHeight - cardH;
            // Only ever compress (never spread past the natural overlap).
            const next =
                peeks > 0 ? Math.max(0.12, Math.min(1, room / peeks)) : 1;
            // Skip no-op updates so a ResizeObserver re-measure can never feed
            // back into an endless render loop.
            setFit((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        const mq = window.matchMedia("(min-width: 1024px)");
        mq.addEventListener("change", measure);
        return () => {
            ro.disconnect();
            mq.removeEventListener("change", measure);
        };
    }, [faceKey]);

    return (
        <div
            ref={ref}
            className={`flex flex-col items-center ${
                template.fill ? "w-full" : ""
            } lg:h-full lg:min-h-0`}
        >
            {cards.map((item, i) => (
                <div
                    key={item.id}
                    data-cascade-card
                    className={`w-full ${template.fill ? "" : CARD_WIDTH_CLASS[template.cardSize ?? "md"]}`}
                    style={
                        i === 0
                            ? undefined
                            : {
                                  // Overlap = full card height minus the (possibly
                                  // compressed) peek the card above should show.
                                  marginTop: `calc(${
                                      cards[i - 1].faceDown
                                          ? CASCADE_PEEK.down
                                          : CASCADE_PEEK.up
                                  } * ${fit} * 100% - 140%)`,
                              }
                    }
                >
                    <ZoneCard item={item} template={template} ctx={ctx} fill />
                </div>
            ))}
        </div>
    );
}

/**
 * A horizontal run with a thrown-card tilt (the trick pile). The pile grows as
 * a round plays out, so the overlap tightens to keep every card on the felt
 * — fully fitting the available width instead of marching off the edge.
 */
function CardRow({ instance, template, ctx }: TableZoneProps) {
    const size = template.cardSize ?? "md";
    const ref = useRef<HTMLDivElement>(null);
    const n = instance.cards.length;
    // `heightMode` cards are sized in px to the bounded board; otherwise they
    // fall back to the width scale. `overlap` is the px each card slides over
    // the previous one so the row always fits its width.
    const [box, setBox] = useState({
        cardW: CARD_PX_ESTIMATE[size],
        overlap: 0,
        heightMode: false,
    });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const heightMode = window.matchMedia("(min-width: 1024px)").matches;
            let cardW: number;
            if (heightMode) {
                // The board is height-bounded at `lg`; cap the trick cards to
                // the center region so a grown pile never climbs into the seats.
                const region = el.closest<HTMLElement>("[data-center-region]");
                const regionH = region?.clientHeight ?? 0;
                // Reserve for the caption, status line, gaps and frame padding.
                const cardH = Math.max(56, Math.min(210, regionH - 100));
                cardW = Math.round((cardH * 5) / 7);
            } else {
                const first = el.querySelector<HTMLElement>("[data-row-card]");
                cardW = first?.offsetWidth || CARD_PX_ESTIMATE[size];
            }
            const avail = el.clientWidth;
            if (cardW <= 0) return;
            // Natural step ≈ a 1.4rem (22.4px) overlap; tighten only as needed so
            // cardW + (n-1)·step ≤ avail. step floors at 0 (cards may fully stack).
            const natural = cardW - 22.4;
            const maxStep = n > 1 ? (avail - cardW) / (n - 1) : natural;
            const step = Math.max(0, Math.min(natural, maxStep));
            setBox({ cardW, overlap: cardW - step, heightMode });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        const region = el.closest<HTMLElement>("[data-center-region]");
        if (region) ro.observe(region);
        const mq = window.matchMedia("(min-width: 1024px)");
        mq.addEventListener("change", measure);
        return () => {
            ro.disconnect();
            mq.removeEventListener("change", measure);
        };
    }, [size, n]);

    return (
        <div
            ref={ref}
            className="flex w-full min-w-0 items-center justify-center"
        >
            {instance.cards.map((item, i) => (
                <div
                    key={item.id}
                    data-row-card
                    className={box.heightMode ? "" : CARD_WIDTH_CLASS[size]}
                    style={{
                        width: box.heightMode ? box.cardW : undefined,
                        marginLeft: i === 0 ? 0 : -box.overlap,
                        transform: `rotate(${tableTilt(item.id)}deg)`,
                    }}
                >
                    <ZoneCard
                        item={item}
                        template={template}
                        ctx={ctx}
                        fill={box.heightMode}
                    />
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

    const wrapRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState(() => {
        const cardW = CARD_PX_ESTIMATE[size];
        return { cardW, cardH: cardW * 1.4, avail: 9999, heightMode: false };
    });
    const [picked, setPicked] = useState<readonly string[]>([]);

    // The board is height-bounded at `lg` (`lg:h-[78vh]`), so on those screens
    // the fan must size its cards to the *height* it's given — otherwise a
    // width-driven hand overflows and the board clips its bottom. Below `lg`
    // the board scrolls with the page, so we keep the width-driven scale.
    //
    // Measure in layout px — offset*/client* ignore the fan rotation, so the
    // geometry never compounds the tilt. Re-measure on resize (375px → 2K).
    useEffect(() => {
        const wrap = wrapRef.current;
        const row = rowRef.current;
        if (!wrap || !row) return;
        const measure = () => {
            const avail = row.clientWidth;
            const heightMode = window.matchMedia("(min-width: 1024px)").matches;
            let cardW: number;
            let cardH: number;
            if (heightMode) {
                // Card height fills the bounded region, minus the lift headroom
                // a selected card needs and the commit row. The commit row is
                // reserved *always* — even when it isn't shown — so the hand is
                // the exact same size on every turn and never jumps when the
                // viewer passes, selects, or the turn moves to an opponent.
                const arc = wrap.clientHeight - 44;
                cardH = Math.max(72, Math.min(240, arc - SELECT_LIFT - 12));
                cardW = Math.round((cardH * 5) / 7);
            } else {
                const first = row.querySelector<HTMLElement>("[data-fan-card]");
                cardW = first?.offsetWidth || CARD_PX_ESTIMATE[size];
                cardH = first?.offsetHeight || cardW * 1.4;
            }
            // A row of absolute-positioned cards can momentarily report a
            // collapsed width (its parent has no in-flow content to size to).
            // Never accept a width narrower than a single card — that would
            // flip the fan angle negative and stack every card behind the first.
            if (cardW > 0 && avail > cardW)
                setBox({ cardW, cardH, avail, heightMode });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(wrap);
        ro.observe(row);
        const mq = window.matchMedia("(min-width: 1024px)");
        mq.addEventListener("change", measure);
        return () => {
            ro.disconnect();
            mq.removeEventListener("change", measure);
        };
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
        <div
            ref={wrapRef}
            className="flex w-full flex-col items-center gap-2 lg:h-full"
        >
            {/* Reserve the commit row whenever the hand is a picker, so the
                fan never jumps the moment the first card is selected. */}
            {selection && (
                <div className="flex h-9 shrink-0 items-center justify-center">
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
                className={`relative w-full ${
                    box.heightMode ? "lg:min-h-0 lg:flex-1" : ""
                }`}
                style={
                    box.heightMode
                        ? undefined
                        : { height: box.cardH + SELECT_LIFT + 8 }
                }
            >
                {cards.map((item, i) => {
                    const deg = ((i - mid) * stepRad) / DEG;
                    const isSel = sel.includes(item.id);
                    return (
                        <div
                            key={item.id}
                            data-fan-card
                            className={`${
                                box.heightMode ? "" : CARD_WIDTH_CLASS[size]
                            } absolute bottom-0 left-1/2 transition-transform duration-150`}
                            style={{
                                width: box.heightMode ? box.cardW : undefined,
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
