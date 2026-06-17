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
    /** Card scale for this zone — defaults to "md". Ignored when `fill` is set. */
    readonly cardSize?: CardSize;
    /** Draw the themed zone panel behind the cards. */
    readonly framed?: boolean;
    /**
     * Stretch this zone to share its row's width (`flex-1`) instead of sizing to
     * a fixed card scale — its cards then size to the column. Lets a game lay a
     * fixed number of side-by-side columns that fill the board responsively
     * (solitaire's seven tableau columns) from mobile to 2K, never wrapping.
     */
    readonly fill?: boolean;
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
    /** Dispatched when the card is clicked (direct-play zones). */
    readonly action?: GameAction;
    /**
     * Selection group, for hands that build a combo by tapping cards (see
     * {@link HandSelection}). Cards sharing a `group` can be picked together
     * (e.g. same rank); a card with no `group` cannot be selected.
     */
    readonly group?: string;
    /**
     * A blocked move for the viewer right now — their turn, but this card
     * cannot be played legally. Carries no `action`/`group`; a click surfaces
     * an "illegal move" notice instead of doing anything.
     */
    readonly illegal?: boolean;
    /**
     * Drag-and-drop destinations for this card, keyed by the target zone's
     * {@link TableZoneInstance.key}. Present → the card is draggable; dropping
     * it on a listed zone dispatches that target's `action`. Lets a game offer
     * an explicit "pick the destination" interaction (solitaire), with the
     * `action` field acting as the double-click auto-move shortcut.
     */
    readonly dropTargets?: ReadonlyArray<{
        readonly zoneKey: string;
        readonly action: GameAction;
    }>;
    /**
     * Cards that move *with* this one when dragged (top-to-bottom, this card
     * first) — e.g. a solitaire tableau run. Drives the floating drag clone and
     * tells the table which source cards to hide mid-drag. Omitted → just this
     * card moves.
     */
    readonly dragStack?: ReadonlyArray<{
        readonly id: string;
        readonly card: CardDescriptor;
        readonly ownerId?: string;
    }>;
}

/** One legal combo a hand can commit, keyed by selection group + size. */
export interface TableHandPlay {
    /** Matches the {@link TableCardItem.group} of the cards it consumes. */
    readonly group: string;
    /** How many cards of that group this play lays. */
    readonly count: number;
    /** Dispatched when the matching selection is committed. */
    readonly action: GameAction;
}

/**
 * Tap-to-build-a-combo config for a hand zone. The viewer selects cards (the
 * fan lifts them); when the selection matches one of `plays` by group + size,
 * the commit button (labelled `playLabel`) arms and dispatches that play.
 * Present only on the viewer's hand and only on their turn.
 */
export interface HandSelection {
    readonly plays: readonly TableHandPlay[];
    /** Localized label for the commit button ("Jouer"). */
    readonly playLabel: string;
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
    /** Turns a `fan` hand into a tap-to-build-a-combo picker. */
    readonly selection?: HandSelection;
    /**
     * Clicking anywhere in the zone — including when it is empty — dispatches
     * this action. Used for pile affordances with no single card to click, e.g.
     * the solitaire stock (draw a card, or recycle the waste when empty).
     */
    readonly action?: GameAction;
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
