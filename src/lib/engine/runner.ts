import { createRng, type GameSeed, randomSeed } from "./rng";
import { fail } from "./rules";
import type {
    ApplyResult,
    GameAction,
    GameEvent,
    GameModule,
    GameState,
    Player,
    RuleViolation,
} from "./types";

export interface CreateGameOptions {
    /** Omitted ⇒ fresh 128-bit crypto seed; a `number` deals with the legacy generator. */
    readonly seed?: GameSeed;
    /** Omitted ⇒ `crypto.randomUUID()`. */
    readonly gameId?: string;
    readonly rules?: Record<string, boolean>;
}

export function withGameRules<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    rules: Record<string, boolean> | undefined,
): GameModule<S, A, V> {
    if (!rules || !module.withRules) return module;
    return module.withRules(rules);
}

/** The rules a game was dealt with (stamped as `state.rules`) — needed to re-derive it. */
export function persistedRules(
    state: GameState,
): Record<string, boolean> | undefined {
    const raw = (state as GameState & { rules?: unknown }).rules;
    if (typeof raw !== "object" || raw === null) return undefined;
    const rules: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "boolean") rules[key] = value;
    }
    return rules;
}

export function createGame<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    options: CreateGameOptions = {},
): S {
    const bound = withGameRules(module, options.rules);
    if (
        players.length < bound.minPlayers ||
        players.length > bound.maxPlayers
    ) {
        throw new RangeError(
            `${bound.id}: expected ${bound.minPlayers}–${bound.maxPlayers} players, got ${players.length}`,
        );
    }
    const seed = options.seed ?? randomSeed();
    const rng = createRng(seed);
    const state = bound.setup(
        players,
        rng,
        seed,
        options.gameId ?? crypto.randomUUID(),
    );
    return { ...state, turn: 0, rngState: rng.state };
}

/**
 * Server-authoritative entry point. Checks only what is game-agnostic —
 * identity, seating, game over — then seeds the RNG from the state and
 * writes back `turn` and the advanced cursor, so no module can forget to
 * persist either. Turn/phase ownership stays in `apply`.
 */
export function dispatch<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    state: S,
    action: A,
    actorId: string,
): ApplyResult<S> {
    if (action.playerId !== actorId) {
        return fail(
            "identity_mismatch",
            "Action actor does not match the authenticated user.",
        );
    }
    if (!state.players.some((p) => p.id === actorId)) {
        return fail("not_seated", "The actor is not seated in this game.");
    }
    if (module.isOver(state)) {
        return fail("game_over", "The game has already finished.");
    }

    const rng = createRng(state.rngState);
    const result = module.apply(state, action, rng);
    if (!result.ok) return result;
    return {
        ...result,
        state: { ...result.state, turn: state.turn + 1, rngState: rng.state },
    };
}

export interface ReplayOptions {
    /** Needed for exact state equality. */
    readonly gameId?: string;
    readonly rules?: Record<string, boolean>;
}

export interface ReplayFrame<S extends GameState, A extends GameAction> {
    /** `-1` for the opening deal. */
    readonly index: number;
    readonly action: A | null;
    /** Unredacted — pass through `view()` before it leaves the server. */
    readonly state: S;
    readonly events: readonly GameEvent[];
}

export interface ReplayDivergence<A extends GameAction> {
    readonly index: number;
    readonly action: A;
    readonly error: RuleViolation;
}

function openReplay<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: GameSeed,
    { gameId, rules }: ReplayOptions = {},
): { bound: GameModule<S, A, V>; opening: S } {
    const bound = withGameRules(module, rules);
    return { bound, opening: createGame(bound, players, { seed, gameId }) };
}

/**
 * Yields the opening deal then one frame per action; returns the first
 * divergence (and stops there), or `null` once the whole log re-derived.
 */
export function* replayFrames<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: GameSeed,
    actions: readonly A[],
    options?: ReplayOptions,
): Generator<ReplayFrame<S, A>, ReplayDivergence<A> | null, void> {
    const { bound, opening } = openReplay(module, players, seed, options);
    let state = opening;
    yield { index: -1, action: null, state, events: [] };

    for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        // The log was identity-checked when recorded; the actor is the author.
        const result = dispatch(bound, state, action, action.playerId);
        if (!result.ok) return { index, action, error: result.error };
        state = result.state;
        yield { index, action, state, events: result.events };
    }
    return null;
}

/**
 * Re-derive a game from `(players, seed, log, rules)`. Throws on divergence:
 * the log was tampered with, or the module's rules changed since recording.
 */
export function replay<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: GameSeed,
    actions: readonly A[],
    options?: ReplayOptions,
): S {
    const { bound, opening } = openReplay(module, players, seed, options);
    return actions.reduce((state, action, index) => {
        const result = dispatch(bound, state, action, action.playerId);
        if (!result.ok) {
            throw new Error(
                `replay diverged at action ${index} ("${action.type}"): ${result.error.code}`,
            );
        }
        return result.state;
    }, opening);
}

export interface ClientState<A extends GameAction, V> {
    readonly view: V;
    readonly legalActions: readonly A[];
    readonly isOver: boolean;
}

/** The redacted payload for one client (`viewerId === null` = spectator). */
export function clientState<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    state: S,
    viewerId: string | null,
): ClientState<A, V> {
    return {
        view: module.view(state, viewerId),
        legalActions: viewerId ? module.legalActions(state, viewerId) : [],
        isOver: module.isOver(state),
    };
}
