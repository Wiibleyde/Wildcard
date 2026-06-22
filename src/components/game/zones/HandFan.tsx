"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/card/Card";
import { GameButton } from "@/components/ui/GameButton";
import { BOUNDED_MQ, useBoundedMeasure } from "@/hooks/game/useBoundedMeasure";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import type { TableCardItem } from "@/lib/games/table/types";
import { CARD_PX_ESTIMATE, type TableZoneProps } from "../TableZone";

const DEG = Math.PI / 180;
const FAN_MAX_HALF = 28 * DEG;
const FAN_MAX_STEP = 7 * DEG;
const SELECT_LIFT = 26;

export function HandFan({ instance, template, ctx }: TableZoneProps) {
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

    // Height-bounded at `lg`: size cards to height or the board clips; below `lg` keep width scale. Measure in layout px (offset*/client*) so the fan rotation doesn't compound the tilt.
    useBoundedMeasure(
        wrapRef,
        () => {
            const wrap = wrapRef.current;
            const row = rowRef.current;
            if (!wrap || !row) return;
            const avail = row.clientWidth;
            const heightMode = window.matchMedia(BOUNDED_MQ).matches;
            let cardW: number;
            let cardH: number;
            if (heightMode) {
                // Commit row reserved always (even when hidden) so the hand is the same size every turn and never jumps.
                const arc = wrap.clientHeight - 44;
                cardH = Math.max(72, Math.min(240, arc - SELECT_LIFT - 12));
                cardW = Math.round((cardH * 5) / 7);
            } else {
                const first = row.querySelector<HTMLElement>("[data-fan-card]");
                cardW = first?.offsetWidth || CARD_PX_ESTIMATE[size];
                cardH = first?.offsetHeight || cardW * 1.4;
            }
            // Never accept a width below one card: absolute cards can briefly report a collapsed width, which flips the fan angle negative and stacks every card behind the first.
            if (cardW > 0 && avail > cardW)
                setBox({ cardW, cardH, avail, heightMode });
        },
        [size],
        () => [rowRef.current],
    );

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

    const mid = (n - 1) / 2;
    const pivotY = box.cardH + box.cardW * 1.6;
    const rho = pivotY - box.cardH / 2;
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
            {/* Reserve the commit row so the fan never jumps when the first card is selected. */}
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
