import type { DeckDefinition } from "@/lib/card/decks";
import type { GameSeed, Rng, RngState } from "./rng";

/** A seat at the table. */
export interface Player {
    readonly id: string;
    readonly name: string;
    /** 0-based seating order. */
    readonly seat: number;
}

/**
 * Fields every game state shares. Concrete games extend this with their own
 * board/hand/score shape.
 *
 * State is immutable (`readonly`): reducers return a new state rather than
 * mutating, which is what makes replay, undo, and time-travel debugging
 * possible.
 */
export interface GameState {
    readonly gameId: string;
    readonly players: readonly Player[];
    /** Game-defined phase, e.g. "bidding" | "reveal" | "done". */
    readonly phase: string;
    /**
     * Who must act next; `null` when no single player owes an action
     * (simultaneous reveal, engine-driven step).
     */
    readonly currentPlayerId: string | null;
    /** Increments once per applied action. */
    readonly turn: number;
    /**
     * Immutable game seed — kept for audit and replay. Server-only: it must
     * never appear in a `view()` (it would let a client pre-compute every
     * shuffle). New games get a 128-bit `"sfc32:…"` seed; a plain `number` is
     * a legacy 32-bit mulberry32 seed, still replayed bit-identically.
     */
    readonly seed: GameSeed;
    /**
     * Evolving RNG cursor — advances on each shuffle/draw. Same encoding as
     * `seed`; the runner rewrites it after every successful `dispatch`.
     */
    readonly rngState: RngState;
}

/**
 * Base action. Concrete games narrow `type` and add payload fields through a
 * discriminated union, e.g.
 * `{ type: "playCard"; playerId: string; card: CardDescriptor }`.
 */
export interface GameAction {
    readonly type: string;
    /**
     * Actor. The runner verifies this matches the authenticated user before
     * the module ever sees the action.
     */
    readonly playerId: string;
}

/** A fact about what changed — fed to the UI for animations and the game log. */
export interface GameEvent {
    readonly type: string;
    readonly payload?: Record<string, unknown>;
}

/** Why an action was refused. */
export interface RuleViolation {
    /** Machine-readable, e.g. "not_your_turn" | "illegal_move". */
    readonly code: string;
    readonly message: string;
}

/** Result of a reducer step — either a new state or a refusal. */
export type ApplyResult<S extends GameState> =
    | {
          readonly ok: true;
          readonly state: S;
          readonly events: readonly GameEvent[];
      }
    | { readonly ok: false; readonly error: RuleViolation };

/**
 * A boolean rule the host can flip in the lobby before the deal. Games declare
 * their toggles generically so the lobby UI, server validation, and storage
 * stay game-agnostic — a new game ships its own list, nothing else changes.
 */
export interface GameRuleToggle {
    /** Stable key — matches a field of the game's own rules object. */
    readonly key: string;
    /** Value used when the host hasn't chosen (and the lobby default). */
    readonly default: boolean;
    /** Another toggle that must be ON for this one to apply (UI greys it out,
     * the server forces it OFF otherwise). */
    readonly requires?: string;
}

/**
 * Resolve a host's raw rule selection against a game's declared toggles:
 * unknown keys are dropped, missing keys fall back to their default, and a
 * toggle whose `requires` dependency is OFF is forced OFF. Pure — shared by the
 * lobby page, the config route, and `startGame`, so every layer agrees.
 */
export function resolveRuleToggles(
    toggles: readonly GameRuleToggle[] | undefined,
    input: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (!toggles) return out;
    for (const toggle of toggles) {
        const value = input?.[toggle.key];
        out[toggle.key] = typeof value === "boolean" ? value : toggle.default;
    }
    // Second pass: a dependency that ended up OFF disables its dependants.
    for (const toggle of toggles) {
        if (toggle.requires && !out[toggle.requires]) out[toggle.key] = false;
    }
    return out;
}

/**
 * A named rule preset — « règles françaises », « War (anglaise) », « Vegas »…
 * A mode is pure data over the game's toggles: picking it in the lobby writes
 * its values into the same `key → boolean` map the toggles already persist, so
 * modes need no storage, route, or engine change of their own. The FIRST mode
 * of a game's list is its default and must match the toggles' defaults (the
 * French rules whenever a French variant exists).
 */
export interface GameRuleMode {
    /** Stable key, unique across the catalog (i18n: `lobby.modes.<key>`). */
    readonly key: string;
    /** Value of every toggle under this mode; a missing key = its default. */
    readonly rules: Readonly<Record<string, boolean>>;
}

/** Full, resolved toggle map a mode stands for. */
export function ruleModeValues(
    toggles: readonly GameRuleToggle[] | undefined,
    mode: GameRuleMode,
): Record<string, boolean> {
    return resolveRuleToggles(toggles, mode.rules);
}

/**
 * The mode a resolved rule set corresponds to, or `null` when the host has
 * tweaked toggles away from every preset (« personnalisé »). Derived, never
 * stored — one source of truth: the toggle map itself.
 */
export function matchRuleMode(
    modes: readonly GameRuleMode[] | undefined,
    toggles: readonly GameRuleToggle[] | undefined,
    rules: Readonly<Record<string, boolean>>,
): GameRuleMode | null {
    if (!modes || !toggles) return null;
    return (
        modes.find((mode) => {
            const values = ruleModeValues(toggles, mode);
            return toggles.every((t) => values[t.key] === rules[t.key]);
        }) ?? null
    );
}

/** Final standings once the game is over. */
export interface GameOutcome {
    /** Players ranked best-first; equal `rank` means a tie. */
    readonly rankings: ReadonlyArray<{
        readonly playerId: string;
        /** 1 = first place. Tied players share a rank. */
        readonly rank: number;
        /** Game-specific score, if any (points, cards held, …). */
        readonly score?: number;
    }>;
    /**
     * Players who won — normally everyone sharing rank 1. May be empty when a
     * game ends without a winner (a resigned solo game keeps its single
     * player at rank 1 but lists no winner).
     */
    readonly winners: readonly string[];
}

/**
 * A self-contained game. The engine drives every game — native TypeScript
 * module or ECA studio game — through this single contract.
 *
 * Type parameters:
 * - `S`: full server-side state (the source of truth).
 * - `A`: the action union this game accepts.
 * - `V`: the redacted, client-safe view (defaults to `S` for games with no
 *   hidden information). `view()` enforces "a player only sees their own hand"
 *   in code, as defense-in-depth on top of database RLS.
 */
export interface GameModule<S extends GameState, A extends GameAction, V = S> {
    readonly id: string;
    readonly name: string;
    readonly deck: DeckDefinition;
    readonly minPlayers: number;
    readonly maxPlayers: number;

    /**
     * Optional rules the host may toggle in the lobby; omitted = none. The
     * chosen set is resolved with {@link resolveRuleToggles} and bound into a
     * fresh module via {@link GameModule.withRules} at deal time.
     */
    readonly ruleToggles?: readonly GameRuleToggle[];

    /**
     * Named presets over {@link ruleToggles} offered at launch (first = the
     * default, French rules when they exist). Omitted = no mode picker.
     */
    readonly ruleModes?: readonly GameRuleMode[];

    /**
     * Action types the platform's naive bots never take unless nothing else is
     * legal — gambles a random policy would only ever lose (e.g. announcing a
     * Tarot slam). Omitted = every legal action is fair game.
     */
    readonly riskyActions?: readonly string[];

    /**
     * Rebuild this module bound to a host-chosen rule set (already resolved to
     * a `key → boolean` map). Games with no `ruleToggles` may omit it; the
     * runner then deals the module as-is.
     */
    withRules?(rules: Record<string, boolean>): GameModule<S, A, V>;

    /**
     * Build the opening state, using `rng` for the initial shuffle/deal.
     * The runner supplies all impure inputs — randomness (`rng`/`seed`) and
     * identity (`gameId`) — so setup stays a pure function and a game can be
     * re-derived exactly from `(gameId, seed, action log)`.
     */
    setup(
        players: readonly Player[],
        rng: Rng,
        seed: GameSeed,
        gameId: string,
    ): S;

    /** Actions `playerId` may legally take right now — for UI hints and bots. */
    legalActions(state: S, playerId: string): readonly A[];

    /**
     * Validate and apply one action. Pure: never mutates `state`. The module
     * owns turn/phase ownership checks and rejects illegal moves with a
     * {@link RuleViolation}.
     */
    apply(state: S, action: A, rng: Rng): ApplyResult<S>;

    isOver(state: S): boolean;

    /** Final standings, or `null` while the game is still running. */
    outcome(state: S): GameOutcome | null;

    /**
     * Project state down to what `viewerId` is allowed to see.
     * `null` = spectator view.
     */
    view(state: S, viewerId: string | null): V;
}

/**
 * Type-erased game module, as stored in the registry and handled by the runner.
 *
 * Every hook on {@link GameModule} is declared with METHOD syntax, which
 * TypeScript checks bivariantly in its parameters (even under
 * `strictFunctionTypes`). That is what lets a concrete
 * `GameModule<BatailleState, BatailleAction, BatailleView>` widen to this
 * erased type with no cast at all. The bivariance is sound here because the
 * registry only ever feeds a module the state it itself produced
 * (round-tripped through `game_states`). Keep the hooks as methods: turning
 * one into a function-typed property (`apply: (s: S) => …`) would make the
 * module invariant and break registration at compile time — loudly, not
 * silently.
 */
export type AnyGameModule = GameModule<GameState, GameAction, unknown>;

/**
 * Register a concrete module under the erased registry type. Cast-free (see
 * {@link AnyGameModule}); the function exists to name the erasure boundary.
 */
export function registerGame<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
): AnyGameModule {
    return module;
}
