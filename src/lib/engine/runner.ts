import { createRng, type GameSeed, randomSeed } from "./rng";
import type {
    ApplyResult,
    GameAction,
    GameEvent,
    GameModule,
    GameState,
    Player,
    RuleViolation,
} from "./types";

/** Options for {@link createGame} — every field optional. */
export interface CreateGameOptions {
    /**
     * Fixed seed (tests, replay). Omitted ⇒ a fresh 128-bit crypto seed. A
     * plain `number` deals with the legacy 32-bit generator — only for
     * re-deriving games recorded before the switch.
     */
    readonly seed?: GameSeed;
    /**
     * Explicit game id, e.g. so the `games` row id equals `state.gameId`.
     * Omitted ⇒ `crypto.randomUUID()`.
     */
    readonly gameId?: string;
    /**
     * Host-chosen table rules (resolved `key → boolean`). Bound through
     * `module.withRules` before the deal; ignored by modules without rules.
     */
    readonly rules?: Record<string, boolean>;
}

/** Bind `rules` into `module` when it supports them; otherwise as-is. */
export function withGameRules<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    rules: Record<string, boolean> | undefined,
): GameModule<S, A, V> {
    if (!rules || !module.withRules) return module;
    return module.withRules(rules);
}

/**
 * The table rules a game was dealt with, read back from its persisted state
 * (configurable modules stamp them as `state.rules`, a `key → boolean` map) —
 * what a re-derivation must bind to deal the same game again.
 */
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

function isCreateGameOptions(
    value: GameSeed | CreateGameOptions | undefined,
): value is CreateGameOptions {
    return typeof value === "object" && value !== null;
}

/**
 * Create a fresh game. Generates a random 128-bit seed and a gameId unless
 * supplied — pass fixed values in tests (and in {@link replay}) for
 * reproducibility.
 *
 * Two call shapes (both supported, the second is preferred):
 * - `createGame(module, players, seed?, gameId?)` — positional, historical;
 * - `createGame(module, players, { seed?, gameId?, rules? })`.
 *
 * The runner owns every impure input (seed, gameId); modules stay pure. The
 * returned state carries the audit `seed` and the initial `rngState`, so
 * every later `apply` resumes the same deterministic sequence.
 */
export function createGame<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seedOrOptions?: GameSeed | CreateGameOptions,
    gameId?: string,
): S {
    const options: CreateGameOptions = isCreateGameOptions(seedOrOptions)
        ? seedOrOptions
        : { seed: seedOrOptions, gameId };
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
    return { ...state, rngState: rng.state };
}

const refuse = <S extends GameState>(
    code: string,
    message: string,
): ApplyResult<S> => ({ ok: false, error: { code, message } });

/**
 * Server-authoritative entry point: validate and apply one action.
 *
 * The runner enforces only what is game-agnostic:
 * 1. the action's actor matches the authenticated user (`actorId`) —
 *    `identity_mismatch`;
 * 2. that actor is seated in this game (`state.players`) — `not_seated`.
 *    Every game, solo included, seats its actors (bots are seated players
 *    too), so a non-participant is refused before the module runs;
 * 3. the game isn't already over — `game_over`;
 * 4. randomness is seeded from the current state (deterministic), and the
 *    advanced cursor is written back to `rngState` on success — a module
 *    that forgets to persist `rng.state` can therefore never replay a
 *    shuffle.
 *
 * Turn/phase ownership and move legality belong to the module (`apply`),
 * because "whose turn it is" differs per game — simultaneous, sequential, or
 * single-player.
 */
export function dispatch<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    state: S,
    action: A,
    actorId: string,
): ApplyResult<S> {
    if (action.playerId !== actorId) {
        return refuse(
            "identity_mismatch",
            "Action actor does not match the authenticated user.",
        );
    }

    if (!state.players.some((p) => p.id === actorId)) {
        return refuse("not_seated", "The actor is not seated in this game.");
    }

    if (module.isOver(state)) {
        return refuse("game_over", "The game has already finished.");
    }

    const rng = createRng(state.rngState);
    const result = module.apply(state, action, rng);
    if (!result.ok) return result;
    return { ...result, state: { ...result.state, rngState: rng.state } };
}

/** Options for {@link replay} / {@link replayFrames}. */
export interface ReplayOptions {
    /** Original game id — needed for exact state equality. */
    readonly gameId?: string;
    /**
     * Table rules the game was played under (e.g. the persisted
     * `state.rules`). Bound via `module.withRules` before the deal, so a
     * configured game re-derives exactly instead of being dealt with the
     * module defaults.
     */
    readonly rules?: Record<string, boolean>;
}

/** One step of a replay: the opening deal, then one frame per action. */
export interface ReplayFrame<S extends GameState, A extends GameAction> {
    /** Index in the action log; `-1` for the opening deal. */
    readonly index: number;
    /** The action that produced this frame (`null` for the opening deal). */
    readonly action: A | null;
    /** Full (unredacted) state after this step — redact with `view()`. */
    readonly state: S;
    /** Events emitted by this step (`[]` for the opening deal). */
    readonly events: readonly GameEvent[];
}

/** Where and why a replayed log stopped re-deriving. */
export interface ReplayDivergence<A extends GameAction> {
    readonly index: number;
    readonly action: A;
    readonly error: RuleViolation;
}

function normalizeReplayOptions(
    options: string | ReplayOptions | undefined,
): ReplayOptions {
    return typeof options === "string" ? { gameId: options } : (options ?? {});
}

/**
 * Step-wise replay: yields the opening deal, then one frame per applied
 * action. Returns `null` when the whole log re-derived, or the first
 * {@link ReplayDivergence} (the generator stops there). Lets a caller build
 * a frame-by-frame viewer (redact each `frame.state` with `view()`) without
 * re-implementing the fold, the rules binding, or the seeding.
 */
export function* replayFrames<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: GameSeed,
    actions: readonly A[],
    options?: string | ReplayOptions,
): Generator<ReplayFrame<S, A>, ReplayDivergence<A> | null, void> {
    const { gameId, rules } = normalizeReplayOptions(options);
    const bound = withGameRules(module, rules);
    let state = createGame(bound, players, { seed, gameId });
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
 * Re-derive a game from its inputs: same module + players + seed + action log
 * (+ gameId for exact state equality, + rules for a configured game) ⇒
 * identical state. This makes the determinism guarantee concrete — replay,
 * audit (the server can re-derive any state a client claims), crash
 * recovery, and spectator catch-up all fall out of it.
 *
 * The last argument is either the gameId (historical) or
 * `{ gameId?, rules? }`.
 *
 * Throws if any logged action is refused: a divergence means the log was
 * tampered with or the module's rules changed since the game was recorded.
 */
export function replay<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: GameSeed,
    actions: readonly A[],
    options?: string | ReplayOptions,
): S {
    const frames = replayFrames(module, players, seed, actions, options);
    let last: S | undefined;
    for (;;) {
        const step = frames.next();
        if (step.done) {
            const divergence = step.value;
            if (divergence) {
                throw new Error(
                    `replay diverged at action ${divergence.index} ("${divergence.action.type}"): ${divergence.error.code}`,
                );
            }
            if (!last) throw new Error("replay produced no state");
            return last;
        }
        last = step.value.state;
    }
}

/** Everything one client is allowed to receive for the current state. */
export interface ClientState<A extends GameAction, V> {
    readonly view: V;
    readonly legalActions: readonly A[];
    readonly isOver: boolean;
}

/**
 * Build the redacted payload to push to a single client — or a spectator when
 * `viewerId` is `null`. Pairs `view()` (hidden info stripped) with the legal
 * actions that client may take.
 */
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
