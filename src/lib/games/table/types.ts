import type { CardSize } from "@/lib/card/sizes";
import type { CardDescriptor } from "@/lib/card/types";
import type { GameAction, GameEvent } from "@/lib/engine/types";

/**
 * Config-driven table layouts — ONE generic component (`GameTable`) renders
 * every game from a per-game {@link GameTableConfig} declared next to its
 * module. No per-game React components: a game describes WHERE cards live
 * (zone templates) and HOW its view maps onto them (a pure `mapView`
 * function), and the component does the rest.
 *
 * The zone model covers the three families the platform targets:
 * - classic multiplayer (Bataille, Président…): seats on top, a framed
 *   center zone, a fanned hand at the bottom;
 * - solitaire: `stack` piles (stock/waste/foundations) on top and `cascade`
 *   columns in the center — e.g.
 *   `{ id: "tableau", placement: "center", arrangement: "cascade" }` with
 *   seven instances emitted by `mapView`;
 * - custom/studio games: any combination of templates and instances.
 */

/** Vertical band of the board a zone renders into. */
export type ZonePlacement = "top" | "center" | "bottom";

/**
 * How a zone lays its cards out:
 * - `row`     — side by side with a light overlap (tricks, reveals)
 * - `fan`     — strong overlap with hover lift (the viewer's hand)
 * - `stack`   — a pile; only the top cards show, badge carries the count
 * - `cascade` — vertical run, each card peeking from under the next
 *   (solitaire tableau columns)
 */
export type ZoneArrangement = "row" | "fan" | "stack" | "cascade";

/**
 * Static zone template — the "card placement" part of a game's config.
 * `mapView` emits one or more {@link TableZoneInstance}s per template
 * (e.g. one `reveal` instance per player, seven `tableau` instances).
 */
export interface TableZoneTemplate {
    readonly id: string;
    readonly placement: ZonePlacement;
    readonly arrangement: ZoneArrangement;
    /** Card scale for this zone — defaults to "md". */
    readonly cardSize?: CardSize;
    /** Draw the themed zone panel behind the cards. */
    readonly framed?: boolean;
}

/** One card on the table, ready to render. */
export interface TableCardItem {
    /** Stable unique id across the whole table — React key + animation identity. */
    readonly id: string;
    readonly card: CardDescriptor;
    readonly faceDown?: boolean;
    /**
     * Player whose deck style skins this card for every viewer.
     * Omitted → the viewer's own deck.
     */
    readonly ownerId?: string;
    /** Dispatched when the card is clicked. */
    readonly action?: GameAction;
}

/** A rendered occurrence of a zone template, filled by `mapView`. */
export interface TableZoneInstance {
    /** Unique key among all instances (e.g. `"reveal:p1"`, `"tableau:3"`). */
    readonly key: string;
    /** Template id this instance renders with. */
    readonly zone: string;
    readonly cards: readonly TableCardItem[];
    /** Small caption under the zone (player name, pile count…). */
    readonly caption?: string;
    /** Accent pill above the zone (e.g. "Président"). */
    readonly badge?: string;
    /** Placeholder text when the zone is empty. */
    readonly emptyHint?: string;
}

/** Opponent chip rendered in the seats bar. */
export interface TableSeat {
    readonly playerId: string;
    readonly name: string;
    /** Face-down mini cards shown under the name; `null` hides them. */
    readonly handCount: number | null;
    readonly isTurn: boolean;
    /** Status line: "a passé", "Président"… */
    readonly status?: string;
}

/** Action button rendered in the controls bar. */
export interface TableControl {
    readonly key: string;
    readonly label?: string;
    /** Mini cards rendered inside the button (combo pickers). */
    readonly cards?: readonly CardDescriptor[];
    readonly action: GameAction;
    readonly variant?: "primary" | "success" | "danger";
}

/** Everything `GameTable` needs for one render, produced by `mapView`. */
export interface TableData {
    readonly banner: { readonly label: string; readonly highlight: boolean };
    /** Opponent chips (classic games) — omit for solitaire. */
    readonly seats?: readonly TableSeat[];
    readonly zones: readonly TableZoneInstance[];
    readonly controls?: readonly TableControl[];
    /** Accent status line under the center zones (round results…). */
    readonly status?: string;
}

/** Minimal seat info adapters can rely on (structurally GamePlayer). */
export interface TablePlayer {
    readonly userId: string;
    readonly username: string;
    /** deck_style_id resolved from player_customizations ("free" fallback). */
    readonly deckStyleId?: string;
}

/** Localized text lookup in the `game` dictionary namespace. */
export type TableText = (
    key: string,
    values?: Record<string, string | number>,
) => string;

/** Render-time inputs handed to `mapView` alongside the game view. */
export interface TableContext {
    /** Seated viewer, or `null` for spectators. */
    readonly viewerId: string | null;
    readonly players: readonly TablePlayer[];
    readonly legalActions: readonly GameAction[];
    readonly isOver: boolean;
    readonly t: TableText;
}

/**
 * A game's complete table description: zone templates (placement config)
 * plus the pure view→table projection. Lives in the game's folder and is
 * registered in the catalog (`src/lib/games/index.ts`).
 */
export interface GameTableConfig<V> {
    readonly zones: readonly TableZoneTemplate[];
    /** Pure projection — no JSX, fully unit-testable. */
    mapView(view: V, ctx: TableContext): TableData;
    /**
     * Localized, user-friendly sentence for one history event — `null` hides
     * it (noise like per-step internals). Drives the log feed next to the
     * table; omitting the hook hides the feed for that game.
     */
    logLine?(event: GameEvent, ctx: TableContext): string | null;
}

/** Type-erased table config, as stored in the catalog. */
export type AnyGameTableConfig = GameTableConfig<unknown>;

/**
 * Register a concrete table config under the erased catalog type. Same
 * single-cast justification as `registerGame`: a table only ever receives
 * the view its own module produced.
 */
export function registerTable<V>(
    config: GameTableConfig<V>,
): AnyGameTableConfig {
    return config as AnyGameTableConfig;
}
