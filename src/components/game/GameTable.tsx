"use client";

import { useGSAP } from "@gsap/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";
import { buildSurfaceStyle } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";
import { getPlayAnimation, prefersReducedMotion } from "@/lib/card/animations";
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
    /** Optional right-rail slot rendered under the history feed (e.g. chat). */
    chat?: ReactNode;
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
    chat,
}: GameTableProps) {
    const t = useTranslations("game");
    const text: TableText = (key, values) =>
        // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
        t(key as any, values as any);

    const ctx: TableContext = {
        viewerId: payload.viewerId,
        players: payload.players,
        legalActions: payload.legalActions,
        isOver: payload.isOver,
        t: text,
    };
    const data: TableData = table.mapView(view, ctx);

    // History feed — newest entry first, each event turned into a localized
    // sentence by the game's own `logLine`. Games without the hook get no feed.
    const logLines: GameLogLine[] | null = table.logLine
        ? [...payload.log].reverse().flatMap((entry) =>
              entry.events.flatMap((event, eventIndex) => {
                  const line = table.logLine?.(event, ctx);
                  return line
                      ? [{ id: `${entry.seq}.${eventIndex}`, text: line }]
                      : [];
              }),
          )
        : null;

    const templates = new Map<string, TableZoneTemplate>(
        table.zones.map((z) => [z.id, z]),
    );
    const styleOf = new Map(
        payload.players.map((p) => [p.userId, p.deckStyleId]),
    );
    const themeFor = (ownerId: string | undefined): CardTheme =>
        ownerId === undefined || ownerId === currentUserId
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

    const zoneCtx: ZoneContext = {
        boardTheme,
        pending,
        themeFor,
        registerCard,
        onAction,
    };

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

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 xl:max-w-5xl 2xl:max-w-7xl">
            <TurnBanner
                label={data.banner.label}
                highlight={data.banner.highlight}
            />

            <div className="flex flex-col gap-3 lg:flex-row">
                <div
                    ref={rootRef}
                    className="relative flex min-h-[60vh] flex-1 flex-col gap-3 overflow-hidden rounded-2xl p-3 sm:gap-4 sm:p-4 lg:h-[70vh] lg:min-h-0 xl:p-6"
                    style={buildSurfaceStyle(boardTheme)}
                >
                    {data.seats && (
                        <TableSeats
                            seats={data.seats}
                            boardTheme={boardTheme}
                            deckStyleOf={(playerId) => styleOf.get(playerId)}
                        />
                    )}

                    {top.length > 0 && (
                        <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4 xl:gap-6">
                            {top}
                        </div>
                    )}

                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                        <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6 xl:gap-10">
                            {center}
                        </div>
                        {data.status && (
                            <span
                                className="text-sm font-black xl:text-base"
                                style={{ color: boardTheme.accentColor }}
                            >
                                {data.status}
                            </span>
                        )}
                    </div>

                    {(bottom.length > 0 || controls.length > 0) && (
                        <div className="flex flex-col items-center gap-3">
                            {bottom}
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
                        />
                    )}
                </div>

                {(logLines || chat) && (
                    <div className="flex flex-col gap-3 lg:h-[70vh] lg:self-start">
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
        </div>
    );
}
