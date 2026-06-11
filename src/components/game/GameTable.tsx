"use client";

import { useGSAP } from "@gsap/react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useRef } from "react";
import { Card } from "@/components/card/Card";
import type { BoardTheme } from "@/lib/board/types";
import { getPlayAnimation, prefersReducedMotion } from "@/lib/card/animations";
import { CARD_WIDTH_CLASS, HAND_OVERLAP_CLASS } from "@/lib/card/sizes";
import { getCardTheme } from "@/lib/card/themes";
import type { CardTheme } from "@/lib/card/types";
import { cardKey, FACE_DOWN_CARD } from "@/lib/card/utils";
import type { GameAction } from "@/lib/engine/types";
import type {
    AnyGameTableConfig,
    TableCardItem,
    TableControl,
    TableData,
    TableSeat,
    TableText,
    TableZoneInstance,
    TableZoneTemplate,
} from "@/lib/games/table/types";
import type { GameClientPayload } from "@/lib/models/game";
import { GameOverOverlay, TurnBanner } from "./GameChrome";

/** Deterministic tilt in [-5°, +5°] — "thrown on the table", SSR-safe. */
function tableTilt(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 11) - 5;
}

const CONTROL_VARIANT_STYLE: Record<
    NonNullable<TableControl["variant"]>,
    CSSProperties
> = {
    primary: {
        background: "#f5c516",
        color: "#0d0a05",
        boxShadow: "0 4px 0 0 #7a5a00",
    },
    success: {
        background: "rgba(72,201,122,0.15)",
        color: "#48c97a",
        border: "1px solid rgba(72,201,122,0.5)",
    },
    danger: {
        background: "rgba(224,64,64,0.15)",
        color: "#e04040",
        border: "1px solid rgba(224,64,64,0.5)",
    },
};

/** Top cards a `stack` zone actually renders — the badge carries the rest. */
const STACK_VISIBLE = 3;

interface GameTableProps {
    table: AnyGameTableConfig;
    view: unknown;
    payload: GameClientPayload;
    currentUserId: string;
    /** The viewer's own deck — fallback for cards without an owner. */
    deckTheme: CardTheme;
    boardTheme: BoardTheme;
    pending: boolean;
    onAction: (action: GameAction) => void;
}

/**
 * THE game table. Renders any game from its {@link AnyGameTableConfig}:
 * zone templates say where cards go (top/center/bottom × row/fan/stack/
 * cascade), the game's pure `mapView` says what fills them. Every card is
 * skinned with its owner's deck style and lands with that deck's play
 * animation — no per-game component anywhere.
 */
export function GameTable({
    table,
    view,
    payload,
    currentUserId,
    deckTheme,
    boardTheme,
    pending,
    onAction,
}: GameTableProps) {
    const t = useTranslations("game");
    const text: TableText = (key, values) =>
        // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
        t(key as any, values as any);

    const data: TableData = table.mapView(view, {
        viewerId: payload.viewerId,
        players: payload.players,
        legalActions: payload.legalActions,
        isOver: payload.isOver,
        t: text,
    });

    const templates = new Map<string, TableZoneTemplate>(
        table.zones.map((z) => [z.id, z]),
    );
    const styleOf = new Map(
        payload.players.map((p) => [p.userId, p.deckStyleId]),
    );
    const themeFor = (ownerId: string | undefined): CardTheme =>
        ownerId === undefined
            ? deckTheme
            : ownerId === currentUserId
              ? deckTheme
              : getCardTheme(styleOf.get(ownerId));

    // ── Entry animations — each card lands with its owner deck's template ──
    const rootRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef(new Map<string, HTMLDivElement>());
    const animatedIds = useRef(new Set<string>());

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            for (const zone of data.zones) {
                for (const item of zone.cards) {
                    if (animatedIds.current.has(item.id)) continue;
                    animatedIds.current.add(item.id);
                    const el = cardRefs.current.get(item.id);
                    if (!el) continue;
                    const theme = themeFor(item.ownerId);
                    getPlayAnimation(theme.playAnimation).animate(el, {
                        origin:
                            (item.ownerId ?? currentUserId) === currentUserId
                                ? "self"
                                : "opponent",
                        duration: theme.playAnimation?.duration,
                    });
                }
            }
        },
        { dependencies: [data], scope: rootRef },
    );

    const registerCard = (id: string) => (el: HTMLDivElement | null) => {
        if (el) cardRefs.current.set(id, el);
        else cardRefs.current.delete(id);
    };

    // ── Board chrome styles ──
    const surface = boardTheme.surface;
    const surfaceStyle: CSSProperties = surface.overlay
        ? {
              background: `${surface.overlay}, ${surface.background}`,
              ...surface.style,
          }
        : { background: surface.background, ...surface.style };
    const zonePanelStyle: CSSProperties = {
        background: boardTheme.zone.background,
        border: `1px solid ${boardTheme.zone.borderColor}`,
        boxShadow: boardTheme.zone.boxShadow,
    };
    const badgeStyle: CSSProperties = {
        background: boardTheme.badge.background,
        color: boardTheme.badge.textColor,
    };

    // Render helpers, NOT nested components: defining components inside the
    // render function would give them a fresh identity every render and make
    // React remount the whole subtree (killing in-flight card animations).

    const renderCard = (
        item: TableCardItem,
        template: TableZoneTemplate,
        opts: { style?: CSSProperties; fill?: boolean } = {},
    ) => {
        const clickable = item.action !== undefined && !pending;
        const width = opts.fill
            ? "w-full"
            : CARD_WIDTH_CLASS[template.cardSize ?? "md"];
        return (
            <div
                key={item.id}
                ref={registerCard(item.id)}
                className={`${width} will-change-transform`}
                style={opts.style}
            >
                <Card
                    card={item.card}
                    faceDown={item.faceDown}
                    theme={themeFor(item.ownerId)}
                    disableTransitions={template.arrangement !== "fan"}
                    onClick={
                        clickable && item.action
                            ? () => onAction(item.action as GameAction)
                            : undefined
                    }
                />
            </div>
        );
    };

    const renderZoneCards = (
        instance: TableZoneInstance,
        template: TableZoneTemplate,
    ) => {
        const { arrangement } = template;

        if (instance.cards.length === 0) {
            return (
                <div
                    className={`${CARD_WIDTH_CLASS[template.cardSize ?? "md"]} flex aspect-[5/7] items-center justify-center rounded-md`}
                    style={{ border: "1px dashed rgba(255,255,255,0.2)" }}
                >
                    {instance.emptyHint && (
                        <span
                            className="px-1 text-center text-[10px] font-semibold"
                            style={{
                                color: boardTheme.badge.textColor,
                                opacity: 0.5,
                            }}
                        >
                            {instance.emptyHint}
                        </span>
                    )}
                </div>
            );
        }

        if (arrangement === "fan") {
            return (
                <div className="flex items-end justify-center">
                    {instance.cards.map((item) => (
                        <div
                            key={item.id}
                            className={`${HAND_OVERLAP_CLASS[template.cardSize ?? "lg"]} relative transition-transform duration-150 hover:z-10 hover:-translate-y-2 focus-within:z-10`}
                        >
                            {renderCard(item, template)}
                        </div>
                    ))}
                </div>
            );
        }

        if (arrangement === "stack") {
            const top = instance.cards.slice(-STACK_VISIBLE);
            return (
                <div
                    className={`${CARD_WIDTH_CLASS[template.cardSize ?? "md"]} relative aspect-[5/7]`}
                >
                    {top.map((item, i) => (
                        <div
                            key={item.id}
                            className="absolute inset-0"
                            style={{
                                transform: `translateY(${(i - top.length + 1) * 4}px)`,
                            }}
                        >
                            {renderCard(item, template, { fill: true })}
                        </div>
                    ))}
                </div>
            );
        }

        if (arrangement === "cascade") {
            return (
                <div className="flex flex-col items-center">
                    {instance.cards.map((item, i) =>
                        renderCard(item, template, {
                            style: i === 0 ? undefined : { marginTop: "-105%" },
                        }),
                    )}
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
                        {renderCard(item, template)}
                    </div>
                ))}
            </div>
        );
    };

    const renderZone = (instance: TableZoneInstance) => {
        const template = templates.get(instance.zone);
        if (!template) return null;

        return (
            <div
                key={instance.key}
                className="flex flex-col items-center gap-1.5"
            >
                {instance.badge && (
                    <span
                        className="rounded-full px-3 py-1 text-xs font-black"
                        style={{
                            background: boardTheme.accentColor,
                            color: "#0d0a05",
                        }}
                    >
                        {instance.badge}
                    </span>
                )}
                {template.framed ? (
                    <div
                        className="flex min-h-32 min-w-48 items-center justify-center rounded-xl px-6 py-4"
                        style={zonePanelStyle}
                    >
                        {renderZoneCards(instance, template)}
                    </div>
                ) : (
                    renderZoneCards(instance, template)
                )}
                {instance.caption && (
                    <span
                        className="text-xs font-bold"
                        style={{ color: boardTheme.badge.textColor }}
                    >
                        {instance.caption}
                    </span>
                )}
            </div>
        );
    };

    const renderSeat = (seat: TableSeat) => {
        const seatTheme = getCardTheme(styleOf.get(seat.playerId));
        return (
            <div
                key={seat.playerId}
                className="flex flex-col items-center gap-1"
            >
                <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                        ...badgeStyle,
                        outline: seat.isTurn
                            ? `2px solid ${boardTheme.accentColor}`
                            : undefined,
                    }}
                >
                    {seat.name}
                </span>
                {seat.handCount !== null && (
                    <div className="flex">
                        {Array.from({
                            length: Math.min(seat.handCount, 8),
                        }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: positional face-down placeholders, no identity
                                key={i}
                                className="w-6 first:ml-0 -ml-3"
                            >
                                <Card
                                    card={FACE_DOWN_CARD}
                                    faceDown
                                    theme={seatTheme}
                                />
                            </div>
                        ))}
                    </div>
                )}
                {seat.status && (
                    <span
                        className="text-[11px] font-semibold"
                        style={{ color: boardTheme.badge.textColor }}
                    >
                        {seat.status}
                    </span>
                )}
            </div>
        );
    };

    const byPlacement = (placement: TableZoneTemplate["placement"]) =>
        data.zones.filter(
            (z) => templates.get(z.zone)?.placement === placement,
        );

    const top = byPlacement("top");
    const center = byPlacement("center");
    const bottom = byPlacement("bottom");

    return (
        <div className="mx-auto flex w-full max-w-3xl xl:max-w-5xl flex-col gap-3">
            <TurnBanner
                label={data.banner.label}
                highlight={data.banner.highlight}
            />

            <div
                ref={rootRef}
                className="relative flex min-h-[60vh] flex-col gap-4 overflow-hidden rounded-2xl p-4 xl:p-6"
                style={surfaceStyle}
            >
                {data.seats && data.seats.length > 0 && (
                    <div className="flex flex-wrap items-start justify-around gap-4">
                        {data.seats.map(renderSeat)}
                    </div>
                )}

                {top.length > 0 && (
                    <div className="flex flex-wrap items-start justify-center gap-4 xl:gap-6">
                        {top.map(renderZone)}
                    </div>
                )}

                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                    <div className="flex flex-wrap items-start justify-center gap-6 xl:gap-10">
                        {center.map(renderZone)}
                    </div>
                    {data.status && (
                        <span
                            className="text-sm font-black"
                            style={{ color: boardTheme.accentColor }}
                        >
                            {data.status}
                        </span>
                    )}
                </div>

                {(bottom.length > 0 ||
                    (data.controls && data.controls.length > 0)) && (
                    <div className="flex flex-col items-center gap-3">
                        {bottom.map(renderZone)}
                        {data.controls && data.controls.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                {data.controls.map((control) => (
                                    <button
                                        key={control.key}
                                        type="button"
                                        onClick={() => onAction(control.action)}
                                        disabled={pending}
                                        className={`flex items-center gap-1 rounded-lg disabled:opacity-50 ${
                                            control.cards?.length
                                                ? "px-2 py-1"
                                                : "px-5 py-2 font-black text-sm"
                                        }`}
                                        style={
                                            CONTROL_VARIANT_STYLE[
                                                control.variant ?? "primary"
                                            ]
                                        }
                                    >
                                        {control.cards?.map((card) => (
                                            <div
                                                key={cardKey(card)}
                                                className="w-8"
                                            >
                                                <Card
                                                    card={card}
                                                    theme={deckTheme}
                                                />
                                            </div>
                                        ))}
                                        {control.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {payload.isOver && (
                    <GameOverOverlay
                        outcome={payload.outcome}
                        players={payload.players}
                        currentUserId={currentUserId}
                    />
                )}
            </div>
        </div>
    );
}
