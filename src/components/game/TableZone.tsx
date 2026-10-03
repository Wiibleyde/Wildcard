"use client";

import { useTranslations } from "next-intl";
import { useCardLabel } from "@/components/card/Card";
import { BoardPill } from "@/components/ui/BoardPill";
import { buildZoneStyle } from "@/lib/board/styles";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import { CardRow } from "./CardRow";
import { CascadeColumn } from "./CascadeColumn";
import { HandFan } from "./HandFan";
import { type TableZoneProps, ZoneCard } from "./ZoneCard";
import { ZoneOverlayButton } from "./ZoneOverlayButton";

/** Top cards a `stack` zone renders; the badge carries the count. */
const STACK_VISIBLE = 3;

export function TableZone({ instance, template, ctx }: TableZoneProps) {
    const t = useTranslations("game");
    const labelOf = useCardLabel();
    const isDropTarget =
        ctx.dragging?.targets.some((d) => d.zoneKey === instance.key) ?? false;
    const moveTarget =
        ctx.selection?.targets.find((d) => d.zoneKey === instance.key) ?? null;

    const zoneAction = instance.action;
    const onZoneClick =
        zoneAction && !ctx.pending ? () => ctx.onAction(zoneAction) : undefined;
    // A pile with no clickable card of its own (the stock) gets a real, named
    // button overlay; if its cards are interactive, the wrapper click stays
    // pointer-only so the overlay doesn't swallow them.
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
        : (instance.caption ?? instance.emptyHint ?? t("zone_empty"));
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
                <ZoneOverlayButton
                    label={t("move_here", { target: zoneLabel })}
                    accentColor={ctx.boardTheme.accentColor}
                    onClick={() => ctx.moveSelected(moveTarget.action)}
                />
            ) : (
                zoneButton && (
                    <ZoneOverlayButton
                        label={t("zone_activate", {
                            label:
                                instance.cards.length === 0
                                    ? (instance.emptyHint ?? zoneLabel)
                                    : (instance.caption ?? zoneLabel),
                        })}
                        accentColor={ctx.boardTheme.accentColor}
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
