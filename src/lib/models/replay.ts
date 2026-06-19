import type { SupabaseClient } from "@supabase/supabase-js";
import { createGame, dispatch } from "@/lib/engine/runner";
import type {
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
} from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import { type GamePlayer, playersOf } from "@/lib/models/game";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/** One frame of a replay: the board exactly as it stood after a single move. */
export interface ReplayStep {
    /** Redacted projection for the viewer — never raw state. */
    readonly view: unknown;
    readonly phase: string;
    readonly currentPlayerId: string | null;
    readonly isOver: boolean;
    readonly outcome: GameOutcome | null;
    /** Seat that produced this frame; `null` for the opening deal (frame 0). */
    readonly actorId: string | null;
    /** Public events emitted reaching this frame (empty for frame 0). */
    readonly events: readonly GameEvent[];
}

export interface ReplayPayload {
    readonly gameId: string;
    readonly moduleId: string;
    readonly viewerId: string | null;
    readonly players: readonly GamePlayer[];
    /** Frame 0 = initial deal; one extra frame per logged action. */
    readonly steps: readonly ReplayStep[];
    /** True when an admin force-ended the game before it reached a terminal state. */
    readonly adminEnded: boolean;
    /** True when the move log was pruned by the 15-day retention sweep. */
    readonly expired: boolean;
}

type LoadError = "not_found" | "unknown_game";

/**
 * Reconstruct a finished game frame-by-frame from its inputs — the headline
 * payoff of the deterministic engine (see {@link AGENTS} / `runner.replay`).
 *
 * A game is a pure function of `(seed, players, action log)`: we re-run
 * `createGame` from the recorded seed, then fold the logged actions one at a
 * time, snapshotting the **redacted** `view()` after each. No secret state ever
 * leaves the server, and "replay" costs nothing to store — the log we already
 * keep for audit is the replay.
 *
 * Must run with the service-role `admin` client: `game_states` is RLS-denied to
 * every client key. We surface only per-frame views to the page.
 */
export async function getReplay(
    admin: Admin,
    gameId: string,
    viewerId: string | null,
): Promise<
    { ok: true; payload: ReplayPayload } | { ok: false; error: LoadError }
> {
    const { data: meta } = await admin
        .from("games")
        .select("id, module_id, is_over, version")
        .eq("id", gameId)
        .maybeSingle();
    if (!meta) return { ok: false, error: "not_found" };

    const { data: secret } = await admin
        .from("game_states")
        .select("state")
        .eq("game_id", gameId)
        .maybeSingle();
    if (!secret) return { ok: false, error: "not_found" };
    const finalState = secret.state as unknown as GameState;

    const module = getGameModule(meta.module_id);
    if (!module) return { ok: false, error: "unknown_game" };

    // A replay is private to its participants: only someone who actually sat in
    // the game may open it. We answer `not_found` (not a distinct `forbidden`)
    // so the endpoint never confirms a game id exists to an outsider — replay
    // ids are unguessable UUIDs and stay that way. The viewer is therefore
    // always a seated player here, and sees their own hand redacted in by
    // `view()`.
    const isPlayer =
        viewerId !== null && finalState.players.some((p) => p.id === viewerId);
    if (!isPlayer) return { ok: false, error: "not_found" };
    const viewer = viewerId;

    // Whole action log, oldest first — this drives the re-derivation.
    const { data: rows } = await admin
        .from("game_actions")
        .select("seq, actor_id, action, events")
        .eq("game_id", gameId)
        .order("seq", { ascending: true });
    const actions = rows ?? [];

    // Fold the log, capturing a redacted frame after every applied action. The
    // seed and original seating come from the persisted state, so the re-run is
    // bit-identical to how the game actually played out.
    const fresh = createGame(
        module,
        finalState.players,
        finalState.seed,
        meta.id,
    );
    // Configurable games (Président) stamp the lobby's chosen table rules into
    // state at setup, and `apply` reads them back from there. createGame re-runs
    // setup, which stamps the module *defaults* — so a game played with a
    // non-default rule (e.g. `revolution: false`) would diverge mid-replay. The
    // deal is seed-only, so grafting the persisted rules onto the fresh initial
    // state reproduces the recorded game exactly.
    const persisted = finalState as GameState & { rules?: unknown };
    let state: GameState =
        persisted.rules !== undefined
            ? ({ ...fresh, rules: persisted.rules } as GameState)
            : fresh;
    const frame = (
        actorId: string | null,
        events: readonly GameEvent[],
    ): ReplayStep => ({
        view: module.view(state, viewer),
        phase: state.phase,
        currentPlayerId: state.currentPlayerId,
        isOver: module.isOver(state),
        outcome: module.outcome(state),
        actorId,
        events,
    });

    const steps: ReplayStep[] = [frame(null, [])];
    for (const row of actions) {
        const action = row.action as unknown as GameAction;
        const result = dispatch(module, state, action, action.playerId);
        // A divergence means the log was tampered with or the rules changed
        // since recording — stop gracefully and replay what re-derives cleanly.
        if (!result.ok) break;
        state = result.state;
        steps.push(
            frame(row.actor_id, (row.events ?? []) as unknown as GameEvent[]),
        );
    }

    const players = await playersOf(admin, finalState);

    // A finished game that bumped its version but has no surviving moves had its
    // log pruned by retention (vs. one that never got a move). Computed once so
    // the two flags stay mutually exclusive below.
    const expired = meta.is_over && meta.version > 0 && actions.length === 0;

    return {
        ok: true,
        payload: {
            gameId: meta.id,
            moduleId: meta.module_id,
            viewerId: viewer,
            players,
            steps,
            // An admin force-ended the game (DB says over, but the re-derived
            // state isn't terminal). Excludes the expired case, where state is
            // stuck at the deal only because the log is gone, not because it was
            // cut short.
            adminEnded: meta.is_over && !expired && !module.isOver(state),
            expired,
        },
    };
}
