"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useMemo } from "react";
import { Card } from "@/components/card/Card";
import { useTableCardAnimations } from "@/hooks/game/useTableCardAnimations";
import { CLONE_OFFSET, useTableDrag } from "@/hooks/game/useTableDrag";
import { buildSurfaceStyle } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";
import { getCardTheme } from "@/lib/card/themes";
import type { CardTheme } from "@/lib/card/types";
import type { GameAction } from "@/lib/engine/types";
import type {
    AnyGameTableConfig,
    TableContext,
    TableData,
    TableText,
    TableZoneTemplate,
    ZonePlacement,
} from "@/lib/games/table/types";
import type { GameClientPayload } from "@/lib/models/game";
import { GameOverOverlay, TurnBanner } from "./GameChrome";
import { GameLog, type GameLogLine } from "./GameLog";
import { TableControls } from "./TableControls";
import { TableSeats } from "./TableSeats";
import { TableZone, type ZoneContext } from "./TableZone";

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
    /** Surface an "illegal move" notice when a blocked card is clicked. */
    onIllegal?: () => void;
    /** Optional right-rail slot rendered under the history feed (e.g. chat). */
    chat?: ReactNode;
}

export function GameTable({
    table,
    view,
    payload,
    currentUserId,
    deckTheme,
    boardTheme,
    pending,
    onAction,
    onIllegal,
    chat,
}: GameTableProps) {
    const t = useTranslations("game");
    const text: TableText = useCallback(
        // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
        (key, values) => t(key as any, values as any),
        [t],
    );

    // Everything below is a pure projection of the payload — memoised so the
    // frequent presentation-only re-renders (drag fires ~60×/s, pending toggles,
    // selection) skip the `mapView` recompute and, crucially, keep `data` stable
    // so the GSAP landing effect (keyed on `data`) never re-runs off a real move.
    const ctx: TableContext = useMemo(
        () => ({
            viewerId: payload.viewerId,
            players: payload.players,
            legalActions: payload.legalActions,
            isOver: payload.isOver,
            t: text,
        }),
        [
            payload.viewerId,
            payload.players,
            payload.legalActions,
            payload.isOver,
            text,
        ],
    );
    const data: TableData = useMemo(
        () => table.mapView(view, ctx),
        [table, view, ctx],
    );

    const logLines: GameLogLine[] | null = useMemo(
        () =>
            table.logLine
                ? [...payload.log].reverse().flatMap((entry) =>
                      entry.events.flatMap((event, eventIndex) => {
                          const line = table.logLine?.(event, ctx);
                          return line
                              ? [
                                    {
                                        id: `${entry.seq}.${eventIndex}`,
                                        text: line,
                                    },
                                ]
                              : [];
                      }),
                  )
                : null,
        [table, payload.log, ctx],
    );

    const templates = useMemo(
        () =>
            new Map<string, TableZoneTemplate>(
                table.zones.map((z) => [z.id, z]),
            ),
        [table],
    );
    const styleOf = useMemo(
        () => new Map(payload.players.map((p) => [p.userId, p.deckStyleId])),
        [payload.players],
    );
    const themeFor = useCallback(
        (ownerId: string | undefined): CardTheme =>
            ownerId === undefined || ownerId === currentUserId
                ? deckTheme
                : getCardTheme(styleOf.get(ownerId)),
        [styleOf, deckTheme, currentUserId],
    );

    const { rootRef, registerCard } = useTableCardAnimations(
        data,
        themeFor,
        currentUserId,
    );

    const { dragging, beginDrag } = useTableDrag({
        onAction,
        pending,
        boundsRef: rootRef,
    });

    const zoneCtx: ZoneContext = useMemo(
        () => ({
            boardTheme,
            pending,
            themeFor,
            registerCard,
            onAction,
            onIllegal,
            dragging,
            beginDrag,
        }),
        [
            boardTheme,
            pending,
            themeFor,
            registerCard,
            onAction,
            onIllegal,
            dragging,
            beginDrag,
        ],
    );

    const zonesAt = (placement: ZonePlacement) =>
        data.zones.flatMap((instance) => {
            const template = templates.get(instance.zone);
            if (!template || template.placement !== placement) return [];
            return [
                <TableZone
                    key={instance.key}
                    instance={instance}
                    template={template}
                    ctx={zoneCtx}
                />,
            ];
        });

    const top = zonesAt("top");
    const center = zonesAt("center");
    const bottom = zonesAt("bottom");
    const controls = data.controls ?? [];

    // A `fill` center zone (e.g. solitaire tableau) spans the board in one
    // non-wrapping row; otherwise cards wrap centered.
    const centerFills = data.zones.some(
        (z) =>
            templates.get(z.zone)?.placement === "center" &&
            templates.get(z.zone)?.fill,
    );
    const centerClass = centerFills
        ? "flex w-full items-start justify-center gap-1 sm:gap-2 xl:gap-3 lg:min-h-0 lg:flex-1"
        : "flex flex-wrap items-start justify-center gap-4 sm:gap-6 xl:gap-10";

    const hasHand = bottom.length > 0;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 lg:max-w-none">
            <TurnBanner
                label={data.banner.label}
                highlight={data.banner.highlight}
            />

            <div className="flex flex-col gap-3 lg:flex-row">
                <div
                    ref={rootRef}
                    className="relative flex min-h-[60vh] flex-1 flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4 lg:h-[78vh] lg:min-h-0 xl:p-6"
                    style={{
                        ...buildSurfaceStyle(boardTheme),
                        borderRadius: "clamp(1.125rem, 3vw, 2rem)",
                        border: "3px solid var(--ink)",
                        boxShadow:
                            "inset 0 0 0 3px rgba(0,0,0,0.35), inset 0 0 90px rgba(0,0,0,0.4), 0 10px 0 var(--ink)",
                    }}
                >
                    {/* felt monogram watermark */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center font-display"
                        style={{
                            fontSize: "clamp(80px,17vw,200px)",
                            color: "rgba(255,255,255,0.045)",
                            lineHeight: 1,
                        }}
                    >
                        W
                    </span>

                    {data.seats && (
                        <div className="relative z-10 shrink-0">
                            <TableSeats
                                seats={data.seats}
                                boardTheme={boardTheme}
                                deckStyleOf={(playerId) =>
                                    styleOf.get(playerId)
                                }
                            />
                        </div>
                    )}

                    {top.length > 0 && (
                        <div className="relative z-10 flex shrink-0 flex-wrap items-start justify-center gap-3 sm:gap-4 xl:gap-6">
                            {top}
                        </div>
                    )}

                    <div
                        data-center-region
                        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 lg:flex-4"
                    >
                        <div className={centerClass}>{center}</div>
                        {data.status && (
                            <span
                                className="text-sm font-black xl:text-base"
                                style={{ color: boardTheme.accentColor }}
                            >
                                {data.status}
                            </span>
                        )}
                    </div>

                    {(hasHand || controls.length > 0) && (
                        <div
                            className={`relative z-10 flex w-full shrink-0 flex-col items-center gap-2 sm:gap-3 ${
                                hasHand ? "lg:min-h-0 lg:flex-5" : ""
                            }`}
                        >
                            {hasHand && (
                                <div className="flex w-full items-end justify-center lg:min-h-0 lg:flex-1 lg:items-stretch">
                                    {bottom}
                                </div>
                            )}
                            <TableControls
                                controls={controls}
                                deckTheme={deckTheme}
                                pending={pending}
                                onAction={onAction}
                            />
                        </div>
                    )}

                    {payload.isOver && (
                        <GameOverOverlay
                            outcome={payload.outcome}
                            players={payload.players}
                            currentUserId={currentUserId}
                            titleOf={
                                table.rankTitle
                                    ? (rank, total) =>
                                          table.rankTitle?.(rank, total, ctx) ??
                                          null
                                    : undefined
                            }
                        />
                    )}
                </div>

                {(logLines || chat) && (
                    <div className="flex flex-col gap-3 lg:h-[78vh] lg:self-start">
                        {logLines && (
                            <GameLog
                                title={t("log_title")}
                                emptyText={t("log_empty")}
                                lines={logLines}
                                boardTheme={boardTheme}
                            />
                        )}
                        {chat}
                    </div>
                )}
            </div>

            {/* Fixed to the viewport so the board's overflow can't clip the clone. */}
            {dragging && (
                <div
                    className="pointer-events-none fixed z-9999"
                    style={{ left: dragging.x, top: dragging.y }}
                >
                    {dragging.stack.map((s, i) => (
                        <div
                            key={s.id}
                            className="absolute will-change-transform"
                            style={{
                                top: i * CLONE_OFFSET,
                                left: 0,
                                width: dragging.cardW,
                                transform: "rotate(2deg)",
                                filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.4))",
                            }}
                        >
                            <Card
                                card={s.card}
                                theme={themeFor(s.ownerId)}
                                disableTransitions
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
