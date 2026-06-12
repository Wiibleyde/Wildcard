"use client";

import type { CSSProperties } from "react";
import { Card } from "@/components/card/Card";
import { BoardPill } from "@/components/ui/BoardPill";
import { buildZoneStyle, tableTilt } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";
import { CARD_WIDTH_CLASS, HAND_OVERLAP_CLASS } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import type {
    TableCardItem,
    TableZoneInstance,
    TableZoneTemplate,
} from "@/lib/games/table/types";

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
    return (
        <div className="flex flex-col items-center gap-1.5">
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
                className={`${CARD_WIDTH_CLASS[size]} flex aspect-[5/7] items-center justify-center rounded-md`}
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
        return (
            <div className="flex w-full max-w-full items-end overflow-x-auto">
                <div className="mx-auto flex items-end px-2 pt-3">
                    {instance.cards.map((item) => (
                        <div
                            key={item.id}
                            className={`${HAND_OVERLAP_CLASS[size]} relative shrink-0 transition-transform duration-150 hover:z-10 hover:-translate-y-2 focus-within:z-10`}
                        >
                            <ZoneCard
                                item={item}
                                template={template}
                                ctx={ctx}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
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
            <div className="flex flex-col items-center">
                {instance.cards.map((item, i) => (
                    <ZoneCard
                        key={item.id}
                        item={item}
                        template={template}
                        ctx={ctx}
                        style={i === 0 ? undefined : { marginTop: "-105%" }}
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
    const { action } = item;
    const width = fill ? "w-full" : CARD_WIDTH_CLASS[template.cardSize ?? "md"];

    return (
        <div
            ref={ctx.registerCard(item.id)}
            className={`${width} will-change-transform`}
            style={style}
        >
            <Card
                card={item.card}
                faceDown={item.faceDown}
                theme={ctx.themeFor(item.ownerId)}
                disableTransitions={template.arrangement !== "fan"}
                onClick={
                    action !== undefined && !ctx.pending
                        ? () => ctx.onAction(action)
                        : undefined
                }
            />
        </div>
    );
}
