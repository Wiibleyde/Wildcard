import type { DeckDefinition } from "@/lib/card/decks";
import type { GameSeed, Rng, RngState } from "./rng";

export interface Player {
    readonly id: string;
    readonly name: string;
    readonly seat: number;
}

/** Immutable: reducers return a new state, which is what makes replay possible. */
export interface GameState {
    readonly gameId: string;
    readonly players: readonly Player[];
    readonly phase: string;
    /** `null` when no single player owes an action (simultaneous or engine-driven step). */
    readonly currentPlayerId: string | null;
    /** Owned by the runner: +1 per dispatched action. */
    readonly turn: number;
    /** Server-only — never in a `view()`, it would let a client pre-compute every shuffle. */
    readonly seed: GameSeed;
    /** Owned by the runner: rewritten after every successful dispatch. */
    readonly rngState: RngState;
}

export interface GameAction {
    readonly type: string;
    /** Verified against the authenticated user by the runner before `apply`. */
    readonly playerId: string;
}

export interface GameEvent {
    readonly type: string;
    readonly payload?: Record<string, unknown>;
}

export interface RuleViolation {
    readonly code: string;
    readonly message: string;
}

export type ApplyResult<S extends GameState> =
    | {
          readonly ok: true;
          readonly state: S;
          readonly events: readonly GameEvent[];
      }
    | { readonly ok: false; readonly error: RuleViolation };

export interface GameRuleToggle {
    readonly key: string;
    readonly default: boolean;
    /** Toggle that must be ON for this one to apply (forced OFF otherwise). */
    readonly requires?: string;
}

/** Shared by lobby, config route and deal so every layer agrees on the rules. */
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
    // Fixpoint: switching a toggle off may in turn disable its own dependants.
    let changed = true;
    while (changed) {
        changed = false;
        for (const toggle of toggles) {
            if (toggle.requires && !out[toggle.requires] && out[toggle.key]) {
                out[toggle.key] = false;
                changed = true;
            }
        }
    }
    return out;
}

/** A game's FIRST mode is its default and must match the toggle defaults. */
export interface GameRuleMode {
    /** Unique across the catalog (i18n: `lobby.modes.<key>`). */
    readonly key: string;
    readonly rules: Readonly<Record<string, boolean>>;
}

export function ruleModeValues(
    toggles: readonly GameRuleToggle[] | undefined,
    mode: GameRuleMode,
): Record<string, boolean> {
    return resolveRuleToggles(toggles, mode.rules);
}

/** Derived, never stored: `null` for a custom set. */
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

export interface GameOutcome {
    /** Best first; tied players share a rank. */
    readonly rankings: ReadonlyArray<{
        readonly playerId: string;
        readonly rank: number;
        readonly score?: number;
    }>;
    /** May be empty: a resigned solo game ranks its player 1st but has no winner. */
    readonly winners: readonly string[];
}

/** Native and studio games alike. `view()` is RLS in code, on top of the database policies. */
export interface GameModule<S extends GameState, A extends GameAction, V = S> {
    readonly id: string;
    readonly name: string;
    readonly deck: DeckDefinition;
    readonly minPlayers: number;
    readonly maxPlayers: number;
    readonly ruleToggles?: readonly GameRuleToggle[];
    /** Launch presets over `ruleToggles`; the first is the default. */
    readonly ruleModes?: readonly GameRuleMode[];
    /** Action types naive bots avoid unless nothing else is legal (e.g. announcing a slam). */
    readonly riskyActions?: readonly string[];

    withRules?(rules: Record<string, boolean>): GameModule<S, A, V>;

    /** Pure: the runner supplies every impure input (rng, seed, gameId). */
    setup(
        players: readonly Player[],
        rng: Rng,
        seed: GameSeed,
        gameId: string,
    ): S;

    legalActions(state: S, playerId: string): readonly A[];

    /** Called only through `dispatch` (actor verified and seated, game not over). */
    apply(state: S, action: A, rng: Rng): ApplyResult<S>;

    isOver(state: S): boolean;

    outcome(state: S): GameOutcome | null;

    view(state: S, viewerId: string | null): V;
}

/**
 * Hooks use METHOD syntax on purpose: methods are bivariant, so a concrete
 * module widens to this type without a cast.
 */
export type AnyGameModule = GameModule<GameState, GameAction, unknown>;

export function registerGame<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
): AnyGameModule {
    return module;
}
