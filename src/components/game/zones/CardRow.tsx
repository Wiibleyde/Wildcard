"use client";

import { useRef, useState } from "react";
import { BOUNDED_MQ, useBoundedMeasure } from "@/hooks/game/useBoundedMeasure";
import { tableTilt } from "@/lib/board/styles";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import { CARD_PX_ESTIMATE, type TableZoneProps, ZoneCard } from "../TableZone";

// As the trick pile grows, the overlap tightens to keep every card within the available width.
export function CardRow({ instance, template, ctx }: TableZoneProps) {
    const size = template.cardSize ?? "md";
    const ref = useRef<HTMLDivElement>(null);
    const n = instance.cards.length;
    const [box, setBox] = useState({
        cardW: CARD_PX_ESTIMATE[size],
        overlap: 0,
        heightMode: false,
    });

    useBoundedMeasure(
        ref,
        () => {
            const el = ref.current;
            if (!el) return;
            const heightMode = window.matchMedia(BOUNDED_MQ).matches;
            let cardW: number;
            if (heightMode) {
                // Cap trick cards to the center region so a grown pile never climbs into the seats.
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
            // Natural step = a 1.4rem (22.4px) overlap; tighten so cardW + (n-1)·step ≤ avail, floored at 0 (cards may fully stack).
            const natural = cardW - 22.4;
            const maxStep = n > 1 ? (avail - cardW) / (n - 1) : natural;
            const step = Math.max(0, Math.min(natural, maxStep));
            setBox({ cardW, overlap: cardW - step, heightMode });
        },
        [size, n],
        (el) => [el.closest<HTMLElement>("[data-center-region]")],
    );

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
