import { createRng, randomSeed } from "./rng";
import type {
    ApplyResult,
    GameAction,
    GameModule,
    GameState,
    Player,
} from "./types";

/**
 * Create a fresh game. Generates a random seed and gameId unless supplied —
 * pass fixed values in tests (and in {@link replay}) for reproducibility.
 *
 * The runner owns every impure input (seed, gameId); modules stay pure. The
 * returned state carries the audit `seed` and the initial `rngState`, so
 * every later `apply` resumes the same deterministic sequence.
 */
export function createGame<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: number = randomSeed(),
    gameId: string = crypto.randomUUID(),
): S {
    if (
        players.length < module.minPlayers ||
        players.length > module.maxPlayers
    ) {
        throw new RangeError(
            `${module.id}: expected ${module.minPlayers}–${module.maxPlayers} players, got ${players.length}`,
        );
    }
    const rng = createRng(seed);
    const state = module.setup(players, rng, seed, gameId);
    return { ...state, rngState: rng.state };
}

/**
 * Server-authoritative entry point: validate and apply one action.
 *
 * The runner enforces only what is game-agnostic:
 * 1. the action's actor matches the authenticated user (`actorId`);
 * 2. the game isn't already over;
 * 3. randomness is seeded from the current state (deterministic).
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
        return {
            ok: false,
            error: {
                code: "identity_mismatch",
                message: "Action actor does not match the authenticated user.",
            },
        };
    }

    if (module.isOver(state)) {
        return {
            ok: false,
            error: {
                code: "game_over",
                message: "The game has already finished.",
            },
        };
    }

    const rng = createRng(state.rngState);
    return module.apply(state, action, rng);
}

/**
 * Re-derive a game from its inputs: same module + players + seed + action log
 * (+ gameId for exact state equality) ⇒ identical state. This makes the
 * determinism guarantee concrete — replay, audit (the server can re-derive
 * any state a client claims), crash recovery, and spectator catch-up all
 * fall out of it.
 *
 * Throws if any logged action is refused: a divergence means the log was
 * tampered with or the module's rules changed since the game was recorded.
 */
export function replay<S extends GameState, A extends GameAction, V>(
    module: GameModule<S, A, V>,
    players: readonly Player[],
    seed: number,
    actions: readonly A[],
    gameId?: string,
): S {
    let state = createGame(module, players, seed, gameId);
    actions.forEach((action, index) => {
        // The log was identity-checked when recorded; the actor is the author.
        const result = dispatch(module, state, action, action.playerId);
        if (!result.ok) {
            throw new Error(
                `replay diverged at action ${index} ("${action.type}"): ${result.error.code}`,
            );
        }
        state = result.state;
    });
    return state;
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
