import type { CardSize } from "@/lib/card/sizes";
import type { CardDescriptor } from "@/lib/card/types";
import type { GameAction, GameEvent } from "@/lib/engine/types";

/* One generic `GameTable` renders every game: zone templates + a pure `mapView`, no per-game React. */

export type ZonePlacement = "top" | "center" | "bottom";

export type ZoneArrangement = "row" | "fan" | "stack" | "cascade";

export interface TableZoneTemplate {
    readonly id: string;
    readonly placement: ZonePlacement;
    readonly arrangement: ZoneArrangement;
    /** Ignored with `fill`. */
    readonly cardSize?: CardSize;
    readonly framed?: boolean;
    /** Size cards to the row's width instead of wrapping. */
    readonly fill?: boolean;
}

export interface TableCardItem {
    /** Unique across the table: React key and animation identity. */
    readonly id: string;
    readonly card: CardDescriptor;
    readonly faceDown?: boolean;
    /** Whose deck style skins the card; omitted ⇒ the viewer's. */
    readonly ownerId?: string;
    readonly action?: GameAction;
    /** No group ⇒ not selectable for a combo. */
    readonly group?: string;
    /** Still clickable, so the board can explain why it is blocked. */
    readonly illegal?: boolean;
    readonly dropTargets?: ReadonlyArray<{
        readonly zoneKey: string;
        readonly action: GameAction;
    }>;
    /** Moves with the dragged card (which comes first). */
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

/** A selection matching a play by group and size arms the commit button. */
export interface HandSelection {
    readonly plays: readonly TableHandPlay[];
    readonly playLabel: string;
}

export interface TableZoneInstance {
    /** Unique among instances, e.g. `"tableau:3"`. */
    readonly key: string;
    /** Template id. */
    readonly zone: string;
    readonly cards: readonly TableCardItem[];
    readonly caption?: string;
    readonly badge?: string;
    readonly emptyHint?: string;
    readonly selection?: HandSelection;
    /** Works on an empty zone too (the solitaire stock). */
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
    /** Irreversible: the UI asks first. */
    readonly confirm?: boolean;
    /** Greyed out rather than hidden, so the bar does not jump. */
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

/** Loose on purpose: tables and the catalog build message keys at runtime. */
export type Translate = (
    key: string,
    values?: Record<string, string | number>,
) => string;

/** `A`: the game's action type — `legalActions` come from that game's module. */
export interface TableContext<A extends GameAction = GameAction> {
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
     * Optimistic view after the viewer's own move (the server overwrites it),
     * or `null`. Never predict a move that reveals a hidden card.
     */
    predict?(view: V, action: A, viewerId: string | null): V | null;
    /** `null` hides the event; no hook ⇒ no log feed. */
    logLine?(event: GameEvent, ctx: TableContext<A>): string | null;
    /** Game-over title for a 1-based rank; `null` ⇒ bare position. */
    rankTitle?(
        rank: number,
        total: number,
        ctx: TableContext<A>,
    ): string | null;
}

export type AnyGameTableConfig = GameTableConfig<unknown>;

/** Cast-free erasure: `mapView`/`predict` stay methods (bivariant), like `registerGame`. */
export function registerTable<V, A extends GameAction = GameAction>(
    config: GameTableConfig<V, A>,
): AnyGameTableConfig {
    return config;
}
