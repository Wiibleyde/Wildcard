"use client";

import { useRef, useState } from "react";
import { BOUNDED_MQ, useBoundedMeasure } from "@/hooks/game/useBoundedMeasure";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import { type TableZoneProps, ZoneCard } from "./ZoneCard";

/** Visible peek of a covered card, as a fraction of card width (height = 1.4 × width). */
const CASCADE_PEEK = { up: 1.4 - 0.96, down: 1.4 - 1.22 };

// At `lg` a long column compresses its overlap to fit; below, the page scrolls.
export function CascadeColumn({ instance, template, ctx }: TableZoneProps) {
    const ref = useRef<HTMLDivElement>(null);
    const cards = instance.cards;
    const [fit, setFit] = useState(1);

    // `instance.cards` is a fresh array each render: keyed on a stable signature
    // instead, or the state-setting ResizeObserver loops forever.
    const cardsRef = useRef(cards);
    cardsRef.current = cards;
    const faceKey = cards.map((c) => (c.faceDown ? "1" : "0")).join("");

    useBoundedMeasure(ref, () => {
        const el = ref.current;
        if (!el) return;
        const cur = cardsRef.current;
        const bounded = window.matchMedia(BOUNDED_MQ).matches;
        if (!bounded || cur.length < 2) {
            setFit(1);
            return;
        }
        const first = el.querySelector<HTMLElement>("[data-cascade-card]");
        const cardW = first?.offsetWidth ?? 0;
        const cardH = first?.offsetHeight || cardW * 1.4;
        if (cardW <= 0) return;
        let peeks = 0;
        for (let i = 1; i < cur.length; i++)
            peeks +=
                (cur[i - 1].faceDown ? CASCADE_PEEK.down : CASCADE_PEEK.up) *
                cardW;
        const room = el.clientHeight - cardH;
        const next = peeks > 0 ? Math.max(0.12, Math.min(1, room / peeks)) : 1;
        // Skip no-op updates, or the re-measure feeds back into a render loop.
        setFit((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
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
