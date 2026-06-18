import type { DeckDefinition } from "@/lib/card/decks";
import type { Rng } from "./rng";

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
    /** Immutable game seed — kept for audit and replay. */
    readonly seed: number;
    /** Evolving RNG cursor — advances on each shuffle/draw. */
    readonly rngState: number;
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
    /** Convenience: every player sharing rank 1. */
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
        seed: number,
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
 * Concrete modules are invariant in their own `State`/`Action` (a `BatailleState`
 * reducer cannot accept an arbitrary `GameState`), so they are not structurally
 * assignable to a single supertype. We erase to `unknown` at the registry
 * boundary instead: the registry persists exactly the state each module
 * produced, so feeding it back is sound. The unavoidable cast lives in one
 * place — {@link registerGame} — and nowhere else.
 */
export type AnyGameModule = GameModule<GameState, GameAction, unknown>;

/**
 * Register a concrete module under the erased registry type. The single cast in
 * the codebase: justified because a game only ever receives the state it itself
 * created (round-tripped through `game_states`).
 */
export function registerGame<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
): AnyGameModule {
    return module as unknown as AnyGameModule;
}
