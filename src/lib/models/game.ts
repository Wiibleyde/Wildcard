import type { SupabaseClient } from "@supabase/supabase-js";
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
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

export interface GamePlayer {
    readonly userId: string;
    readonly username: string;
    readonly seat: number;
}

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
        bot_ids: string[];
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
        .select("id, room_id, module_id, version, bot_ids")
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

function playersOf(state: GameState): GamePlayer[] {
    return state.players.map((p) => ({
        userId: p.id,
        username: p.name,
        seat: p.seat,
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

    return {
        ok: true,
        payload: {
            gameId: meta.id,
            moduleId: meta.module_id,
            version: meta.version,
            phase: state.phase,
            isOver: cs.isOver,
            currentPlayerId: state.currentPlayerId,
            view: cs.view,
            legalActions: cs.legalActions,
            outcome: module.outcome(state),
            players: playersOf(state),
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

/** Hard cap so a misbehaving module can never spin the bot loop forever. */
const MAX_BOT_STEPS = 500;

/**
 * Drive every bot whose turn it currently is, one move at a time, until a human
 * is on turn or the game ends. Each step bumps `version` (so Realtime pushes the
 * move to every client), rewrites the secret state, and logs the action.
 *
 * Runs after each human action and once at deal time (the opening leader may be
 * a bot). No compare-and-set needed: the caller already holds the latest
 * version, and a stray human action would lose the version race and refetch.
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
): Promise<number> {
    let state = fromState;
    let version = fromVersion;
    const botSet = new Set(botIds);
    let steps = 0;

    while (
        steps++ < MAX_BOT_STEPS &&
        !module.isOver(state) &&
        state.currentPlayerId !== null &&
        botSet.has(state.currentPlayerId)
    ) {
        const botId = state.currentPlayerId;
        const legal = module.legalActions(state, botId);
        if (legal.length === 0) break;

        const action = chooseBotAction(legal);
        const result = dispatch(module, state, action, botId);
        if (!result.ok) break;

        state = result.state;
        version += 1;
        const over = module.isOver(state);
        const outcome = module.outcome(state);
        const now = new Date().toISOString();

        await admin
            .from("games")
            .update({
                version,
                phase: state.phase,
                current_player_id: state.currentPlayerId,
                is_over: over,
                winner_ids: [...(outcome?.winners ?? [])],
                updated_at: now,
            })
            .eq("id", gameId);
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
        });

        if (over) {
            await admin
                .from("rooms")
                .update({ status: "finished" })
                .eq("id", roomId);
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
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) return loaded;

    const { meta, module, state } = loaded.game;

    if (meta.version !== expectedVersion) {
        return { ok: false, error: "version_conflict" };
    }
    if (typeof rawAction.type !== "string") {
        return { ok: false, error: "invalid_action" };
    }

    // Force the actor — never trust a client-supplied playerId.
    const action = { ...rawAction, playerId: actorId } as GameAction;

    let result: ApplyResult<GameState>;
    try {
        result = dispatch(module, state, action, actorId);
    } catch (err) {
        return {
            ok: false,
            error: "invalid_action",
            message: err instanceof Error ? err.message : String(err),
        };
    }
    if (!result.ok) {
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
        return { ok: false, error: "db_error", message: claimError.message };
    }
    if (!claimed) {
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
        }),
    ]);
    if (stateError) {
        return { ok: false, error: "db_error", message: stateError.message };
    }
    if (logError) {
        return { ok: false, error: "db_error", message: logError.message };
    }

    if (isOver) {
        await admin
            .from("rooms")
            .update({ status: "finished" })
            .eq("id", meta.room_id);
    }

    // Let any bots now on turn play out before returning.
    const finalVersion = await advanceBots(
        admin,
        gameId,
        meta.room_id,
        module,
        newState,
        newVersion,
        meta.bot_ids,
    );

    return { ok: true, version: finalVersion, events: result.events };
}
