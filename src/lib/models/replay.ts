import type { SupabaseClient } from "@supabase/supabase-js";
import { isEcaModuleId } from "@/lib/eca/id";
import type { EcaState } from "@/lib/eca/types";
import { persistedRules, replayFrames } from "@/lib/engine/runner";
import type {
    AnyGameModule,
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
} from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import { ecaModuleFromState } from "@/lib/games/resolve";
import { type GamePlayer, playersOf } from "@/lib/models/game";
import type { Database, GameEndReason } from "@/lib/supabase/types";

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
    /**
     * How the game was closed when it ended out of band (the recorded state
     * never reached a terminal position): `forfeit` (a player left — see
     * `forfeitedBy`), `admin` (force-ended by staff) or `abandoned` (closed by
     * the inactivity reaper). `null` for a game that played to its end.
     */
    readonly interruptedBy: Exclude<GameEndReason, "natural"> | null;
    /** The player who forfeited (`interruptedBy === "forfeit"`). */
    readonly forfeitedBy: string | null;
    /** True when the move log was pruned by the 15-day retention sweep (or is incomplete). */
    readonly expired: boolean;
    /**
     * True when the log did not re-derive the recorded game: an action was
     * refused mid-way, or the fold ended on a state different from the stored
     * one (tampered log, or rules changed since recording). `steps` then holds
     * only the frames that re-derived cleanly.
     */
    readonly diverged: boolean;
}

type LoadError = "not_found" | "unknown_game";

/**
 * Structural equality of two JSON values, ignoring object key order — the
 * stored state comes back from `jsonb`, which reorders keys and drops
 * `undefined` members, so both sides are compared as JSON.
 */
function sameJson(a: unknown, b: unknown): boolean {
    return (
        JSON.stringify(canonical(JSON.parse(JSON.stringify(a ?? null)))) ===
        JSON.stringify(canonical(JSON.parse(JSON.stringify(b ?? null))))
    );
}

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (typeof value === "object" && value !== null) {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value).sort()) {
            out[key] = canonical((value as Record<string, unknown>)[key]);
        }
        return out;
    }
    return value;
}

/** Whether the logged seqs are exactly 1..n — anything else is a partial log. */
function isCompleteLog(seqs: readonly number[]): boolean {
    return seqs.every((seq, i) => seq === i + 1);
}

/**
 * Reconstruct a finished game frame-by-frame from its inputs — the headline
 * payoff of the deterministic engine (see {@link AGENTS} / `runner.replay`).
 *
 * A game is a pure function of `(seed, players, rules, action log)`: the
 * runner's {@link replayFrames} re-deals from the recorded seed with the
 * persisted table rules bound through `module.withRules`, then folds the logged
 * actions through `dispatch` one at a time; we snapshot the **redacted**
 * `view()` of each frame. No secret state ever leaves the server, and "replay"
 * costs nothing to store — the log we already keep for audit is the replay.
 *
 * Integrity is checked, not assumed: a refused action or a fold that does not
 * land on the stored final state flags the replay as `diverged`; a log that
 * was pruned or has holes in its `seq` is `expired`.
 *
 * Must run with the service-role `admin` client: `game_states` and
 * `game_actions` are RLS-denied to every client key.
 */
export async function getReplay(
    admin: Admin,
    gameId: string,
    viewerId: string | null,
): Promise<
    { ok: true; payload: ReplayPayload } | { ok: false; error: LoadError }
> {
    const { data, error } = await admin
        .from("games")
        .select(
            "id, module_id, is_over, end_reason, forfeited_by, actions_pruned_at, game_states(state)",
        )
        .eq("id", gameId)
        .maybeSingle();
    if (error)
        console.error(`[replay] load failed (${gameId}):`, error.message);
    if (!data) return { ok: false, error: "not_found" };
    const { game_states: embedded, ...meta } = data;
    const secret = (Array.isArray(embedded) ? embedded[0] : embedded) as
        | { state: unknown }
        | null
        | undefined;
    if (!secret) return { ok: false, error: "not_found" };
    const finalState = secret.state as GameState;

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

    // Studio games rebuild from the definition stamped into the final state, so
    // a replay re-derives bit-identically without an `eca_games` read.
    let module: AnyGameModule | undefined;
    try {
        module = isEcaModuleId(meta.module_id)
            ? ecaModuleFromState(finalState as EcaState, meta.module_id)
            : getGameModule(meta.module_id);
    } catch (err) {
        console.error(`[replay] module rebuild failed (${gameId}):`, err);
    }
    if (!module) return { ok: false, error: "unknown_game" };

    // Whole action log, oldest first — this drives the re-derivation.
    const { data: rows, error: logError } = await admin
        .from("game_actions")
        .select("seq, actor_id, action, events")
        .eq("game_id", gameId)
        .order("seq", { ascending: true });
    if (logError) {
        console.error(
            `[replay] log read failed (${gameId}):`,
            logError.message,
        );
    }
    const actions = rows ?? [];

    // Pruned by retention, or with holes (missing first seq / gaps): the frames
    // could only be a misleading prefix, so the replay is reported expired.
    const expired =
        meta.actions_pruned_at !== null ||
        logError !== null ||
        !isCompleteLog(actions.map((r) => r.seq));

    // An expired log still shows the opening deal (frame 0), nothing more.
    const folded = expired ? [] : actions;
    const steps: ReplayStep[] = [];
    let lastState: GameState | null = null;
    let diverged = false;
    try {
        const frames = replayFrames(
            module,
            finalState.players,
            finalState.seed,
            folded.map((r) => r.action as unknown as GameAction),
            // The id stamped in the state (equal to games.id since deal-time
            // ids are shared; older games carry their own engine id).
            { gameId: finalState.gameId, rules: persistedRules(finalState) },
        );
        for (;;) {
            const step = frames.next();
            if (step.done) {
                if (step.value) {
                    diverged = true;
                    console.error(
                        `[replay] game ${gameId} diverged at action ${step.value.index}: ${step.value.error.code}`,
                    );
                }
                break;
            }
            const { index, state, events } = step.value;
            lastState = state;
            steps.push({
                view: module.view(state, viewer),
                phase: state.phase,
                currentPlayerId: state.currentPlayerId,
                isOver: module.isOver(state),
                outcome: module.outcome(state),
                actorId: index < 0 ? null : folded[index].actor_id,
                events:
                    index < 0
                        ? events
                        : ((folded[index].events ??
                              []) as unknown as GameEvent[]),
            });
        }
    } catch (err) {
        diverged = true;
        console.error(`[replay] game ${gameId}: module threw:`, err);
    }
    // Every action applied, yet the fold does not land on the recorded
    // state: the log does not describe this game. The RNG cursor is left out:
    // games recorded before the runner persisted it on every step may carry a
    // stale cursor while every game-visible field still matches.
    if (
        !expired &&
        !diverged &&
        lastState &&
        !sameJson(
            { ...lastState, rngState: null },
            { ...finalState, rngState: null },
        )
    ) {
        diverged = true;
        console.error(
            `[replay] game ${gameId}: final state does not match the log`,
        );
    }

    // Not even the deal re-derived (the module throws at setup): nothing to show.
    if (steps.length === 0) return { ok: false, error: "unknown_game" };

    const players = await playersOf(admin, finalState);

    let terminal = false;
    try {
        terminal = module.isOver(finalState);
    } catch {
        terminal = false;
    }

    return {
        ok: true,
        payload: {
            gameId: meta.id,
            moduleId: meta.module_id,
            viewerId: viewer,
            players,
            steps,
            // A forfeit / admin force-end / reap: the DB says over, but the
            // recorded state never reached a terminal position. Read from the
            // stored state, so a zero-move force-ended game is labelled
            // correctly (and never as expired). `end_reason` tells which; a
            // legacy row (null) keeps the old "admin" label.
            interruptedBy:
                meta.is_over && !terminal
                    ? meta.end_reason === "natural" || meta.end_reason === null
                        ? "admin"
                        : meta.end_reason
                    : null,
            forfeitedBy: meta.forfeited_by,
            expired,
            diverged,
        },
    };
}
