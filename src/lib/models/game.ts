import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { clientState, dispatch } from "@/lib/engine/runner";
import type {
    AnyGameModule,
    ApplyResult,
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
    RuleViolation,
} from "@/lib/engine/types";
import { getGameModule } from "@/lib/games";
import { recordGameFinished, recordMove } from "@/lib/metrics/registry";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

export interface GamePlayer {
    readonly userId: string;
    readonly username: string;
    readonly seat: number;
    /**
     * deck_style_id from player_customizations — every viewer renders this
     * player's cards in this style. Bots and unknown players fall back to
     * "free".
     */
    readonly deckStyleId: string;
}

/**
 * One applied action's worth of history: who acted and the public events the
 * reducer emitted for it. Events are public-safe by module contract (only
 * table-visible facts), so every viewer — including spectators — gets the
 * same log.
 */
export interface GameLogEntry {
    readonly seq: number;
    readonly actorId: string;
    readonly events: readonly GameEvent[];
}

/** Most recent actions exposed to clients — enough to scroll a whole round. */
const LOG_LIMIT = 80;

/**
 * Everything one client is allowed to receive for the current game. `view` is
 * the module's redacted projection (opponents' hands stripped) — never raw
 * state. `legalActions` is empty for spectators.
 */
export interface GameClientPayload {
    readonly gameId: string;
    readonly moduleId: string;
    readonly version: number;
    readonly phase: string;
    readonly isOver: boolean;
    readonly currentPlayerId: string | null;
    readonly view: unknown;
    readonly legalActions: readonly GameAction[];
    readonly outcome: GameOutcome | null;
    readonly players: readonly GamePlayer[];
    /** Recent history, oldest first — drives the in-game log feed. */
    readonly log: readonly GameLogEntry[];
    /** The viewer this payload was built for; `null` = spectator. */
    readonly viewerId: string | null;
}

type LoadError = "not_found" | "unknown_game";

interface LoadedGame {
    meta: {
        id: string;
        room_id: string;
        module_id: string;
        version: number;
        is_over: boolean;
        bot_ids: string[];
        created_at: string | null;
    };
    module: AnyGameModule;
    state: GameState;
}

async function loadGame(
    admin: Admin,
    gameId: string,
): Promise<{ ok: true; game: LoadedGame } | { ok: false; error: LoadError }> {
    const { data: meta } = await admin
        .from("games")
        .select("id, room_id, module_id, version, is_over, bot_ids, created_at")
        .eq("id", gameId)
        .maybeSingle();
    if (!meta) return { ok: false, error: "not_found" };

    const { data: secret } = await admin
        .from("game_states")
        .select("state")
        .eq("game_id", gameId)
        .maybeSingle();
    if (!secret) return { ok: false, error: "not_found" };

    const module = getGameModule(meta.module_id);
    if (!module) return { ok: false, error: "unknown_game" };

    return {
        ok: true,
        game: { meta, module, state: secret.state as unknown as GameState },
    };
}

export async function playersOf(
    admin: Admin,
    state: GameState,
): Promise<GamePlayer[]> {
    const ids = state.players.map((p) => p.id);
    const { data } = await admin
        .from("player_customizations")
        .select("user_id, deck_style_id")
        .in("user_id", ids);
    const styles = new Map(
        (data ?? []).map((row) => [row.user_id, row.deck_style_id]),
    );
    return state.players.map((p) => ({
        userId: p.id,
        username: p.name,
        seat: p.seat,
        deckStyleId: styles.get(p.id) ?? "free",
    }));
}

/** Last {@link LOG_LIMIT} applied actions with their events, oldest first. */
async function logOf(admin: Admin, gameId: string): Promise<GameLogEntry[]> {
    const { data } = await admin
        .from("game_actions")
        .select("seq, actor_id, events")
        .eq("game_id", gameId)
        .order("seq", { ascending: false })
        .limit(LOG_LIMIT);
    return (data ?? []).reverse().map((row) => ({
        seq: row.seq,
        actorId: row.actor_id,
        events: row.events as unknown as readonly GameEvent[],
    }));
}

/**
 * Build the redacted payload for one viewer. `viewerId` that is not seated is
 * treated as a spectator (`null` view, no legal actions).
 */
export async function getGameClientState(
    admin: Admin,
    gameId: string,
    viewerId: string | null,
): Promise<
    { ok: true; payload: GameClientPayload } | { ok: false; error: LoadError }
> {
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) return loaded;

    const { meta, module, state } = loaded.game;
    const isPlayer =
        viewerId !== null && state.players.some((p) => p.id === viewerId);
    const effectiveViewer = isPlayer ? viewerId : null;

    const cs = clientState(module, state, effectiveViewer);
    const [players, log] = await Promise.all([
        playersOf(admin, state),
        logOf(admin, gameId),
    ]);

    return {
        ok: true,
        payload: {
            gameId: meta.id,
            moduleId: meta.module_id,
            version: meta.version,
            phase: state.phase,
            // An admin force-end flips the column without touching `state`, so
            // `module.isOver(state)` stays false — the DB flag is the override.
            isOver: cs.isOver || meta.is_over,
            currentPlayerId: state.currentPlayerId,
            view: cs.view,
            legalActions: cs.legalActions,
            outcome: module.outcome(state),
            players,
            log,
            viewerId: effectiveViewer,
        },
    };
}

export type ApplyErrorCode =
    | "not_found"
    | "unknown_game"
    | "version_conflict"
    | "rule_violation"
    | "invalid_action"
    | "db_error";

/** HTTP status for each apply/load error — keeps the route handlers thin. */
export const APPLY_ERROR_STATUS: Record<ApplyErrorCode, number> = {
    not_found: 404,
    unknown_game: 400,
    version_conflict: 409,
    rule_violation: 422,
    invalid_action: 400,
    db_error: 500,
};

/**
 * Bot move policy — intentionally simple ("fill with computers", not a hard
 * opponent): prefer shedding/acting over passing, then pick at random among the
 * remaining legal moves. The choice is non-deterministic but every bot action
 * is written to `game_actions`, so replay from the log stays exact.
 */
function chooseBotAction(legal: readonly GameAction[]): GameAction {
    const active = legal.filter((a) => a.type !== "pass");
    const pool = active.length > 0 ? active : legal;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Hard cap so a misbehaving module can never spin the bot loop forever. Sized
 * for the longest realistic auto-played game: an all-bot Bataille resolves one
 * round per step and a fair game of War can run several hundred rounds, so the
 * ceiling sits well above that while still bounding a runaway module.
 */
const MAX_BOT_STEPS = 2000;

/**
 * Pause before each bot move so every move lands as its own Realtime version
 * bump — clients refetch per move and each card gets its play animation,
 * instead of a whole bot chain appearing at once. Roughly one card animation.
 */
const BOT_TURN_DELAY_MS = 900;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Seconds elapsed since a game's `created_at`, or -1 when it is unknown. */
function durationSeconds(createdAt: string | null): number {
    if (!createdAt) return -1;
    return (Date.now() - new Date(createdAt).getTime()) / 1000;
}

/**
 * Pick the bot that should make the next move, or `null` if a human owns it.
 *
 * Sequential games expose whose turn it is via `currentPlayerId`; we act only
 * when that player is a bot. Simultaneous / engine-driven games leave it `null`
 * (e.g. Bataille, where a single `flip` resolves the round for everyone) — there
 * we drive the round only when *every* player who still has a legal move is a
 * bot, so an all-computer table plays itself while any table with a human waits
 * for that human to act.
 */
function nextBotMover(
    module: AnyGameModule,
    state: GameState,
    botSet: ReadonlySet<string>,
): string | null {
    if (state.currentPlayerId !== null) {
        return botSet.has(state.currentPlayerId) ? state.currentPlayerId : null;
    }
    const actors = state.players.filter(
        (p) => module.legalActions(state, p.id).length > 0,
    );
    if (actors.length === 0) return null;
    if (!actors.every((p) => botSet.has(p.id))) return null;
    return actors[0].id;
}

/**
 * Drive every bot whose turn it currently is, one paced move at a time, until
 * a human is on turn or the game ends. Each step bumps `version` (so Realtime
 * pushes the move to every client), rewrites the secret state, and logs the
 * action.
 *
 * Runs *after the response* of each human action and once at deal time (the
 * opening leader may be a bot) — see the `after()` calls at the call sites.
 * Because the chain now overlaps the request window, each step claims its
 * version transition with a compare-and-set and stops if anything else won
 * the race.
 *
 * Returns the final version after all bot moves.
 */
export async function advanceBots(
    admin: Admin,
    gameId: string,
    roomId: string,
    module: AnyGameModule,
    fromState: GameState,
    fromVersion: number,
    botIds: readonly string[],
    createdAt: string | null,
): Promise<number> {
    let state = fromState;
    let version = fromVersion;
    const botSet = new Set(botIds);
    let steps = 0;

    while (steps++ < MAX_BOT_STEPS && !module.isOver(state)) {
        const botId = nextBotMover(module, state, botSet);
        if (botId === null) break;

        const legal = module.legalActions(state, botId);
        if (legal.length === 0) break;

        // The bot "thinks" — gives every client time to animate the previous
        // play before the next version bump arrives.
        await sleep(BOT_TURN_DELAY_MS);

        const action = chooseBotAction(legal);
        const result = dispatch(module, state, action, botId);
        if (!result.ok) break;

        state = result.state;
        version += 1;
        const over = module.isOver(state);
        const outcome = module.outcome(state);
        const now = new Date().toISOString();

        const { data: claimed } = await admin
            .from("games")
            .update({
                version,
                phase: state.phase,
                current_player_id: state.currentPlayerId,
                is_over: over,
                winner_ids: [...(outcome?.winners ?? [])],
                updated_at: now,
            })
            .eq("id", gameId)
            .eq("version", version - 1)
            .select("id")
            .maybeSingle();
        // Someone else advanced the game while we slept — stop, their chain
        // (or the next human action) owns the state now.
        if (!claimed) break;
        await admin
            .from("game_states")
            .update({
                state: state as unknown as Record<string, unknown>,
                updated_at: now,
            })
            .eq("game_id", gameId);
        await admin.from("game_actions").insert({
            game_id: gameId,
            seq: version,
            actor_id: botId,
            action: action as unknown as Record<string, unknown>,
            events: result.events as unknown as Record<string, unknown>[],
        });

        if (over) {
            await admin
                .from("rooms")
                .update({ status: "finished" })
                .eq("id", roomId);
            recordGameFinished(module.id, durationSeconds(createdAt));
        }
    }

    return version;
}

export type ApplyActionResult =
    | {
          ok: true;
          version: number;
          events: readonly GameEvent[];
      }
    | {
          ok: false;
          error: ApplyErrorCode;
          violation?: RuleViolation;
          message?: string;
      };

/**
 * Server-authoritative action application.
 *
 * 1. The actor is forced to the authenticated user — the client cannot spoof
 *    `playerId`.
 * 2. Optimistic concurrency: `expectedVersion` must match the stored version,
 *    and the meta row is claimed with a compare-and-set (`where version = …`)
 *    so two simultaneous actions can never both commit. A loser gets
 *    `version_conflict` and simply refetches.
 * 3. The module validates legality; illegal moves are refused, never trusted.
 */
export async function applyAction(
    admin: Admin,
    gameId: string,
    actorId: string,
    expectedVersion: number,
    rawAction: Record<string, unknown>,
): Promise<ApplyActionResult> {
    const startedAt = performance.now();
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) {
        recordMove("unknown", loaded.error, performance.now() - startedAt);
        return loaded;
    }

    const { meta, module, state } = loaded.game;
    // Stamp every exit with its latency + outcome — `wildcard_moves_total` is
    // the API throughput/error counter, `wildcard_move_duration_ms` the latency.
    const record = (result: string) =>
        recordMove(meta.module_id, result, performance.now() - startedAt);

    // An admin abort sets `is_over` on the row without mutating `state`, so the
    // module would still accept moves — refuse them here, before dispatch.
    if (meta.is_over) {
        record("rule_violation");
        return {
            ok: false,
            error: "rule_violation",
            violation: {
                code: "game_over",
                message: "The game has already finished.",
            },
        };
    }
    if (meta.version !== expectedVersion) {
        record("version_conflict");
        return { ok: false, error: "version_conflict" };
    }
    if (typeof rawAction.type !== "string") {
        record("invalid_action");
        return { ok: false, error: "invalid_action" };
    }

    // Force the actor — never trust a client-supplied playerId.
    const action = { ...rawAction, playerId: actorId } as GameAction;

    let result: ApplyResult<GameState>;
    try {
        result = dispatch(module, state, action, actorId);
    } catch (err) {
        record("invalid_action");
        return {
            ok: false,
            error: "invalid_action",
            message: err instanceof Error ? err.message : String(err),
        };
    }
    if (!result.ok) {
        record("rule_violation");
        return { ok: false, error: "rule_violation", violation: result.error };
    }

    const newState = result.state;
    const isOver = module.isOver(newState);
    const outcome = module.outcome(newState);
    const newVersion = meta.version + 1;

    // Compare-and-set on the meta row: claims this version transition. If a
    // concurrent action already advanced past `expectedVersion`, no row matches
    // and we bail out without touching the secret state.
    const { data: claimed, error: claimError } = await admin
        .from("games")
        .update({
            version: newVersion,
            phase: newState.phase,
            current_player_id: newState.currentPlayerId,
            is_over: isOver,
            winner_ids: [...(outcome?.winners ?? [])],
            updated_at: new Date().toISOString(),
        })
        .eq("id", gameId)
        .eq("version", expectedVersion)
        .select("id")
        .maybeSingle();
    if (claimError) {
        record("db_error");
        return { ok: false, error: "db_error", message: claimError.message };
    }
    if (!claimed) {
        record("version_conflict");
        return { ok: false, error: "version_conflict" };
    }

    const [{ error: stateError }, { error: logError }] = await Promise.all([
        admin
            .from("game_states")
            .update({
                state: newState as unknown as Record<string, unknown>,
                updated_at: new Date().toISOString(),
            })
            .eq("game_id", gameId),
        admin.from("game_actions").insert({
            game_id: gameId,
            seq: newVersion,
            actor_id: actorId,
            action: action as unknown as Record<string, unknown>,
            events: result.events as unknown as Record<string, unknown>[],
        }),
    ]);
    if (stateError) {
        record("db_error");
        return { ok: false, error: "db_error", message: stateError.message };
    }
    if (logError) {
        record("db_error");
        return { ok: false, error: "db_error", message: logError.message };
    }

    record("ok");

    if (isOver) {
        await admin
            .from("rooms")
            .update({ status: "finished" })
            .eq("id", meta.room_id);
        recordGameFinished(module.id, durationSeconds(meta.created_at));
    }

    // Let any bots now on turn play out AFTER the response: the human's card
    // animates immediately, then each paced bot move arrives over Realtime as
    // its own update — visible turns instead of one burst. Skip when the game
    // already ended (no bot to play, and avoids a redundant finish recording).
    if (!isOver && meta.bot_ids.length > 0) {
        after(() =>
            advanceBots(
                admin,
                gameId,
                meta.room_id,
                module,
                newState,
                newVersion,
                meta.bot_ids,
                meta.created_at,
            ),
        );
    }

    return { ok: true, version: newVersion, events: result.events };
}

export type EndGameResult =
    | { ok: true; version: number }
    | { ok: false; error: ApplyErrorCode };

/**
 * Administrative force-end (admin dashboard "end game" button).
 *
 * This is an out-of-band override, NOT a game action: it never runs the module
 * and writes no `game_actions` row (a synthetic action would break replay,
 * which re-dispatches every logged action through the module). Instead it just
 * flips `is_over` on the row and bumps `version` so every connected client
 * refetches and lands on the game-over screen, finishes the room, and records
 * the finish metric.
 *
 * The version bump is a compare-and-set against the loaded version, so a
 * force-end races cleanly against a concurrent player/bot move — exactly one
 * wins, the loser is a no-op. A game already over is an idempotent success.
 */
export async function endGame(
    admin: Admin,
    gameId: string,
): Promise<EndGameResult> {
    const { data: meta } = await admin
        .from("games")
        .select("id, room_id, module_id, version, is_over, created_at")
        .eq("id", gameId)
        .maybeSingle();
    if (!meta) return { ok: false, error: "not_found" };
    if (meta.is_over) return { ok: true, version: meta.version };

    const newVersion = meta.version + 1;
    const now = new Date().toISOString();

    const { data: claimed, error } = await admin
        .from("games")
        .update({
            version: newVersion,
            is_over: true,
            winner_ids: [],
            updated_at: now,
        })
        .eq("id", gameId)
        .eq("version", meta.version)
        .select("id")
        .maybeSingle();
    if (error) return { ok: false, error: "db_error" };
    // Lost the race to a player/bot move — that move owns the state now.
    if (!claimed) return { ok: false, error: "version_conflict" };

    await admin
        .from("rooms")
        .update({ status: "finished" })
        .eq("id", meta.room_id);
    recordGameFinished(meta.module_id, durationSeconds(meta.created_at));

    return { ok: true, version: newVersion };
}
