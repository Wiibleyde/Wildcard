import type { CardSize } from "@/lib/card/sizes";
import type { CardDescriptor } from "@/lib/card/types";
import type { GameAction, GameEvent } from "@/lib/engine/types";

/*
 * Config-driven tables: ONE generic `GameTable` component renders every game
 * from zone templates (where cards live) plus a pure `mapView` (how the view
 * fills them). No per-game React.
 */

export type ZonePlacement = "top" | "center" | "bottom";

/**
 * `row` side by side · `fan` overlapped hand with hover lift · `stack` a pile
 * (top cards + count) · `cascade` vertical run (solitaire columns).
 */
export type ZoneArrangement = "row" | "fan" | "stack" | "cascade";

export interface TableZoneTemplate {
    readonly id: string;
    readonly placement: ZonePlacement;
    readonly arrangement: ZoneArrangement;
    /** Defaults to "md"; ignored with `fill`. */
    readonly cardSize?: CardSize;
    readonly framed?: boolean;
    /** Share the row's width and size cards to the column (never wraps, mobile → 2K). */
    readonly fill?: boolean;
}

export interface TableCardItem {
    /** Unique across the table — React key and animation identity. */
    readonly id: string;
    readonly card: CardDescriptor;
    readonly faceDown?: boolean;
    /** Player whose deck style skins this card; omitted → the viewer's own. */
    readonly ownerId?: string;
    /** Click / double-click shortcut. */
    readonly action?: GameAction;
    /** Combo-selection group (see {@link HandSelection}); no group ⇒ not selectable. */
    readonly group?: string;
    /** The viewer's turn but this card can't be played: a click explains why. */
    readonly illegal?: boolean;
    /** Present ⇒ draggable; dropping on `zoneKey` dispatches `action`. */
    readonly dropTargets?: ReadonlyArray<{
        readonly zoneKey: string;
        readonly action: GameAction;
    }>;
    /** Cards that move with this one when dragged (this card first). */
    readonly dragStack?: ReadonlyArray<{
        readonly id: string;
        readonly card: CardDescriptor;
        readonly ownerId?: string;
    }>;
}

export interface TableHandPlay {
    readonly group: string;
    readonly count: number;
    readonly action: GameAction;
}

/** Tap-to-build-a-combo hand: a selection matching a play by group + size arms the commit button. */
export interface HandSelection {
    readonly plays: readonly TableHandPlay[];
    readonly playLabel: string;
}

export interface TableZoneInstance {
    /** Unique among instances (e.g. `"reveal:p1"`, `"tableau:3"`). */
    readonly key: string;
    /** Template id. */
    readonly zone: string;
    readonly cards: readonly TableCardItem[];
    readonly caption?: string;
    readonly badge?: string;
    readonly emptyHint?: string;
    readonly selection?: HandSelection;
    /** Click anywhere on the zone, even empty (e.g. the solitaire stock). */
    readonly action?: GameAction;
}

export interface TableSeat {
    readonly playerId: string;
    readonly name: string;
    /** `null` hides the face-down mini cards. */
    readonly handCount: number | null;
    readonly isTurn: boolean;
    readonly status?: string;
}

export interface TableControl {
    readonly key: string;
    readonly label?: string;
    readonly cards?: readonly CardDescriptor[];
    readonly action: GameAction;
    readonly variant?: "primary" | "success" | "danger";
    /** Irreversible verb: the UI confirms before dispatching. */
    readonly confirm?: boolean;
    /** Greyed out rather than hidden, so the controls bar stays stable. */
    readonly disabled?: boolean;
}

export interface TableBanner {
    readonly label: string;
    readonly highlight: boolean;
}

export interface TableData {
    readonly banner: TableBanner;
    readonly seats?: readonly TableSeat[];
    readonly zones: readonly TableZoneInstance[];
    readonly controls?: readonly TableControl[];
    readonly status?: string;
}

export interface TablePlayer {
    readonly userId: string;
    readonly username: string;
    readonly deckStyleId?: string;
}

/**
 * Loose translator both `getTranslations` and `useTranslations` satisfy once
 * cast: tables and the catalog build message keys at runtime.
 */
export type Translate = (
    key: string,
    values?: Record<string, string | number>,
) => string;

/** `A`: the game's action type — `legalActions` come from that game's module. */
export interface TableContext<A extends GameAction = GameAction> {
    /** `null` for spectators. */
    readonly viewerId: string | null;
    readonly players: readonly TablePlayer[];
    readonly legalActions: readonly A[];
    readonly isOver: boolean;
    readonly t: Translate;
}

export interface GameTableConfig<V, A extends GameAction = GameAction> {
    readonly zones: readonly TableZoneTemplate[];
    mapView(view: V, ctx: TableContext<A>): TableData;
    /**
     * Optimistic view after the viewer's own move, or `null` to wait for the
     * server (which always overwrites it). Never predict a move that reveals
     * a hidden card — the prediction would be a guess.
     */
    predict?(view: V, action: A, viewerId: string | null): V | null;
    /** One log line per event; `null` hides it. No hook ⇒ no log feed. */
    logLine?(event: GameEvent, ctx: TableContext<A>): string | null;
    /** Game-over title for a 1-based rank (e.g. Président, Trou du cul); `null` ⇒ bare position. */
    rankTitle?(
        rank: number,
        total: number,
        ctx: TableContext<A>,
    ): string | null;
}

export type AnyGameTableConfig = GameTableConfig<unknown>;

/** Cast-free erasure — keep `mapView`/`predict` as methods (bivariant), like `registerGame`. */
export function registerTable<V, A extends GameAction = GameAction>(
    config: GameTableConfig<V, A>,
): AnyGameTableConfig {
    return config;
}
