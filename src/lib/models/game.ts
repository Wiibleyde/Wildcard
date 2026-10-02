import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { isEcaModuleId } from "@/lib/eca/id";
import type { EcaState } from "@/lib/eca/types";
import {
    clientState,
    dispatch,
    persistedRules,
    replayFrames,
} from "@/lib/engine/runner";
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
import { ecaModuleFromState } from "@/lib/games/resolve";
import { recordGameFinished, recordMove } from "@/lib/metrics/registry";
import { eloResultsForGame } from "@/lib/models/elo";
import {
    describeEnd,
    type GameEndInfo,
    outcomeFromWinners,
    playedMoves,
    resolveEndOutcome,
} from "@/lib/models/gameEnd";
import { xpAwardsForGame } from "@/lib/models/xp";
import { notifyGameVersion } from "@/lib/realtime/notifyGameVersion";
import type { Database, GameEndReason } from "@/lib/supabase/types";

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
    /** Invite code of the room hosting the game — the in-game "leave" posts to it. */
    readonly roomCode: string | null;
    readonly version: number;
    readonly phase: string;
    readonly isOver: boolean;
    readonly currentPlayerId: string | null;
    readonly view: unknown;
    readonly legalActions: readonly GameAction[];
    /**
     * Standings to show. For a natural end, the module's outcome; for a forfeit
     * (state never reached a terminal position), rebuilt from the persisted
     * winners; `null` for an admin / reaper close.
     */
    readonly outcome: GameOutcome | null;
    /** How the game ended — `null` while it is live. */
    readonly end: GameEndInfo | null;
    readonly players: readonly GamePlayer[];
    /** Recent history, oldest first — drives the in-game log feed. */
    readonly log: readonly GameLogEntry[];
    /** The viewer this payload was built for; `null` = spectator. */
    readonly viewerId: string | null;
}

/**
 * One intermediate board a client missed between two reads: the viewer's
 * redacted projection right after move `version`. Lets the client play every
 * move back one at a time instead of jumping straight to the latest state.
 */
export interface GameFrame {
    readonly version: number;
    readonly phase: string;
    readonly currentPlayerId: string | null;
    readonly view: unknown;
}

/**
 * A catch-up read (`GET /api/games/[id]?since=N`): the authoritative head
 * payload plus the frames strictly between `N` and the head, oldest first.
 */
export interface GameSyncPayload extends GameClientPayload {
    readonly frames: readonly GameFrame[];
}

/**
 * Most frames a catch-up returns. A client further behind than this (long
 * background tab, reconnect) plays only the tail — replaying a minute of moves
 * at animation speed would leave it acting on a stale board for just as long.
 */
const MAX_CATCHUP_FRAMES = 8;

type LoadError = "not_found" | "unknown_game";

interface LoadedGame {
    meta: {
        id: string;
        room_id: string;
        module_id: string;
        version: number;
        is_over: boolean;
        bot_ids: string[];
        winner_ids: string[];
        end_reason: GameEndReason | null;
        forfeited_by: string | null;
        created_at: string | null;
        updated_at: string;
        room_code: string | null;
    };
    module: AnyGameModule;
    state: GameState;
}

/**
 * Load a game's public meta AND its secret state in ONE statement (PostgREST
 * embeds `game_states` into the `games` row), so both come from the same
 * snapshot: every commit writes them in one transaction
 * (`wildcard.commit_game_step`), and a read can never pair state N with
 * version N+1.
 */
export async function loadGame(
    admin: Admin,
    gameId: string,
): Promise<{ ok: true; game: LoadedGame } | { ok: false; error: LoadError }> {
    const { data, error } = await admin
        .from("games")
        .select(
            "id, room_id, module_id, version, is_over, bot_ids, winner_ids, end_reason, forfeited_by, created_at, updated_at, game_states(state), rooms!games_room_id_fkey(code)",
        )
        .eq("id", gameId)
        .maybeSingle();
    if (error) {
        console.error(`[game] load failed (${gameId}):`, error.message);
    }
    if (!data) return { ok: false, error: "not_found" };

    const { game_states: embedded, rooms: roomEmbed, ...row } = data;
    const room = (Array.isArray(roomEmbed) ? roomEmbed[0] : roomEmbed) as
        | { code: string }
        | null
        | undefined;
    const meta = { ...row, room_code: room?.code ?? null };
    // One-to-one embed: an object, or a one-element array depending on how the
    // relationship is detected — accept both.
    const secret = (Array.isArray(embedded) ? embedded[0] : embedded) as
        | { state: unknown }
        | null
        | undefined;
    if (!secret) return { ok: false, error: "not_found" };

    const state = secret.state as GameState;
    // Studio games rebuild their module from the definition stamped into the
    // state — no `eca_games` read on this hot path (page load + every poll), and
    // a game stays loadable even if its row was later edited or removed.
    const module = isEcaModuleId(meta.module_id)
        ? ecaModuleFromState(state as EcaState, meta.module_id)
        : getGameModule(meta.module_id);
    if (!module) return { ok: false, error: "unknown_game" };

    return { ok: true, game: { meta, module, state } };
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

/** The persisted facts a {@link GameClientPayload} is shaped from. */
interface PayloadMeta {
    readonly gameId: string;
    readonly moduleId: string;
    readonly roomCode: string | null;
    readonly version: number;
    /** DB `is_over` — an out-of-band end flips it without touching `state`. */
    readonly isOver: boolean;
    readonly endReason: GameEndReason | null;
    readonly forfeitedBy: string | null;
    readonly winnerIds: readonly string[];
    readonly botIds: readonly string[];
}

function payloadMetaOf(meta: LoadedGame["meta"]): PayloadMeta {
    return {
        gameId: meta.id,
        moduleId: meta.module_id,
        roomCode: meta.room_code,
        version: meta.version,
        isOver: meta.is_over,
        endReason: meta.end_reason,
        forfeitedBy: meta.forfeited_by,
        winnerIds: meta.winner_ids,
        botIds: meta.bot_ids,
    };
}

/**
 * Assemble one viewer's redacted payload from an already-loaded module + state.
 * The single place that shapes a {@link GameClientPayload}, shared by the full
 * read ({@link getGameClientState}) and the action commit ({@link applyAction},
 * which returns the actor's fresh payload in the POST response so the client
 * needs no follow-up GET). The end of the game (outcome + {@link GameEndInfo})
 * comes from the persisted row, not only the state: a forfeit / admin end /
 * reaper close flips `is_over` without touching `state`.
 */
function buildClientPayload(
    meta: PayloadMeta,
    module: AnyGameModule,
    state: GameState,
    viewerId: string | null,
    players: GamePlayer[],
    log: GameLogEntry[],
): GameClientPayload {
    const cs = clientState(module, state, viewerId);
    const isOver = cs.isOver || meta.isOver;
    let outcome: GameOutcome | null = null;
    let end: GameEndInfo | null = null;
    if (isOver) {
        const facts = {
            reason: meta.endReason,
            terminal: cs.isOver,
            stateOutcome: cs.isOver ? module.outcome(state) : null,
            playerIds: state.players.map((p) => p.id),
            winnerIds: meta.winnerIds,
            forfeitedBy: meta.forfeitedBy,
        };
        outcome = resolveEndOutcome(facts);
        end = describeEnd({
            ...facts,
            outcome,
            botIds: meta.botIds,
            version: meta.version,
            viewerId,
        });
    }
    return {
        gameId: meta.gameId,
        moduleId: meta.moduleId,
        roomCode: meta.roomCode,
        version: meta.version,
        phase: state.phase,
        isOver,
        currentPlayerId: state.currentPlayerId,
        view: cs.view,
        // A force-ended (admin / forfeit / reaper) game keeps a non-terminal
        // state: the module would still list moves the server refuses.
        legalActions: isOver ? [] : cs.legalActions,
        outcome,
        end,
        players,
        log,
        viewerId,
    };
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
    const result = await getGameSync(admin, gameId, viewerId, null);
    if (!result.ok) return result;
    const { frames: _frames, ...payload } = result.payload;
    return { ok: true, payload };
}

/**
 * {@link getGameClientState} plus the moves the client has not seen yet.
 * `since` is the last version the client holds (`null` = no catch-up). When it
 * is exactly one move behind — the usual case, one doorbell per move — the
 * head *is* that move and no frame is computed.
 */
export async function getGameSync(
    admin: Admin,
    gameId: string,
    viewerId: string | null,
    since: number | null,
): Promise<
    { ok: true; payload: GameSyncPayload } | { ok: false; error: LoadError }
> {
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) return loaded;

    // Self-heal a stranded bot chain: the bot loop is an in-process `after()`
    // task that a dropped/killed invocation or restart can lose mid-turn,
    // leaving a bot on turn with nothing to drive it. Every viewer read (page
    // load + the ~800ms poll) re-kicks it once it has clearly stalled.
    maybeResumeBots(admin, loaded.game);

    const { meta, module, state } = loaded.game;
    const isPlayer =
        viewerId !== null && state.players.some((p) => p.id === viewerId);
    const effectiveViewer = isPlayer ? viewerId : null;

    const [players, log, frames] = await Promise.all([
        playersOf(admin, state),
        logOf(admin, gameId),
        since === null
            ? []
            : catchUpFrames(
                  admin,
                  gameId,
                  module,
                  state,
                  meta.version,
                  since,
                  effectiveViewer,
              ),
    ]);

    return {
        ok: true,
        payload: {
            ...buildClientPayload(
                payloadMetaOf(meta),
                module,
                state,
                effectiveViewer,
                players,
                log,
            ),
            frames,
        },
    };
}

/**
 * The boards between `since` (exclusive) and `head` (exclusive), redacted for
 * `viewerId`. Only the head state is stored, so intermediate states are
 * re-derived from `(seed, rules, action log)` — the deterministic engine's
 * replay, reused for live catch-up. Each frame goes through `view()`, so a
 * client receives exactly what it would have seen live, nothing more.
 *
 * Purely cosmetic: on any doubt (pruned or holed log, divergence, module
 * fault) it returns no frames and the client just jumps to the head.
 */
async function catchUpFrames(
    admin: Admin,
    gameId: string,
    module: AnyGameModule,
    state: GameState,
    head: number,
    since: number,
    viewerId: string | null,
): Promise<GameFrame[]> {
    const from = Math.max(since + 1, head - MAX_CATCHUP_FRAMES);
    if (from >= head) return [];

    const { data: rows, error } = await admin
        .from("game_actions")
        .select("seq, action")
        .eq("game_id", gameId)
        .lte("seq", head)
        .order("seq", { ascending: true });
    if (error || !rows) return [];
    // The fold needs the whole log 1..head; anything else can't re-derive.
    if (rows.length !== head || rows.some((r, i) => r.seq !== i + 1)) {
        return [];
    }

    const out: GameFrame[] = [];
    try {
        const frames = replayFrames(
            module,
            state.players,
            state.seed,
            rows.map((r) => r.action as unknown as GameAction),
            { gameId: state.gameId, rules: persistedRules(state) },
        );
        for (const { index, state: s } of frames) {
            const version = index + 1;
            if (version < from) continue;
            if (version >= head) break;
            out.push({
                version,
                phase: s.phase,
                currentPlayerId: s.currentPlayerId,
                view: module.view(s, viewerId),
            });
        }
    } catch (err) {
        console.error(`[game] catch-up replay failed (${gameId}):`, err);
        return [];
    }
    return out;
}

export interface GameVersionInfo {
    readonly version: number;
    readonly isOver: boolean;
}

/**
 * Cheap "did anything change?" probe for the poll/doorbell hot path. Reads only
 * the small public meta row — no secret `state`, no action log, no `view()`
 * projection — so a client can poll it at the bot-move cadence for a handful of
 * bytes and pull the full redacted payload ({@link getGameClientState}) only
 * once `version` has actually advanced past what it holds.
 *
 * Bot self-heal still piggybacks on the read, but only on the rare *idle* path:
 * a live game (and a healthy bot chain pacing its moves) bumps `updated_at` well
 * inside the stall window, so the heavy state load needed to confirm a stranded
 * chain runs only after the row has sat untouched past {@link STALL_RESUME_MS} —
 * never on a normal tick.
 */
export async function getGameVersion(
    admin: Admin,
    gameId: string,
): Promise<GameVersionInfo | null> {
    const { data: meta } = await admin
        .from("games")
        .select("version, is_over, bot_ids, current_player_id, updated_at")
        .eq("id", gameId)
        .maybeSingle();
    if (!meta) return null;

    if (!meta.is_over && meta.bot_ids.length > 0) {
        const idleMs = Date.now() - new Date(meta.updated_at).getTime();
        // Sequential: only a bot on turn can be stranded. Simultaneous
        // (current_player_id null): a bot *might* drive the round — confirm with
        // state. Either way we touch state only once genuinely stale.
        const maybeBotTurn =
            meta.current_player_id === null ||
            meta.bot_ids.includes(meta.current_player_id);
        if (maybeBotTurn && idleMs >= STALL_RESUME_MS) {
            const loaded = await loadGame(admin, gameId);
            if (loaded.ok) maybeResumeBots(admin, loaded.game);
        }
    }

    return { version: meta.version, isOver: meta.is_over };
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
    // The game exists but its module cannot be rebuilt (removed from the
    // registry, corrupt stamped definition): a server fault, not a bad request.
    unknown_game: 500,
    version_conflict: 409,
    rule_violation: 422,
    invalid_action: 400,
    db_error: 500,
};

/**
 * Bot move policy — intentionally simple ("fill with computers", not a hard
 * opponent): never gamble on a module's `riskyActions` (a slam announcement…),
 * prefer shedding/acting over passing, then pick at random among the remaining
 * legal moves. The choice is non-deterministic but every bot action is written
 * to `game_actions`, so replay from the log stays exact.
 */
export function chooseBotAction(
    legal: readonly GameAction[],
    risky: readonly string[] = [],
): GameAction {
    const safe = legal.filter((a) => !risky.includes(a.type));
    const candidates = safe.length > 0 ? safe : legal;
    const active = candidates.filter((a) => a.type !== "pass");
    const pool = active.length > 0 ? active : candidates;
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

/** A bot on turn whose game has sat untouched for this long is treated as a
 * stranded chain and re-kicked. Comfortably above one paced bot move
 * ({@link BOT_TURN_DELAY_MS}) so a healthy, still-running chain is never
 * double-driven into the same turn. */
const STALL_RESUME_MS = 3000;

/**
 * Re-launch the bot chain when it has died mid-turn. The bot loop is an
 * in-process `after()` task; a dropped/killed serverless invocation or a server
 * restart can lose it, stranding a bot on turn with nothing to drive it (the
 * game sits at `is_over = false` waiting on a player who will never move).
 *
 * Safe to call on every viewer read: it no-ops unless a bot genuinely owns the
 * turn and the game has been untouched past {@link STALL_RESUME_MS}, and
 * `advanceBots`'s per-step compare-and-set means racing kicks from several
 * concurrent reads collapse to a single live chain.
 */
function maybeResumeBots(admin: Admin, game: LoadedGame): void {
    const { meta, module, state } = game;
    if (meta.is_over || meta.bot_ids.length === 0) return;
    const idleMs = Date.now() - new Date(meta.updated_at).getTime();
    if (idleMs < STALL_RESUME_MS) return; // a live chain is still pacing moves
    try {
        if (module.isOver(state)) return;
        // Nobody (or a human) owns the turn → nothing to resume.
        if (nextBotMover(module, state, new Set(meta.bot_ids)) === null) {
            return;
        }
    } catch (err) {
        // A module fault must not turn a viewer read into a 500.
        console.error(`[bots] game ${meta.id}: resume check threw:`, err);
        return;
    }
    after(() =>
        advanceBots(
            admin,
            meta.id,
            module,
            state,
            meta.version,
            meta.bot_ids,
            meta.created_at,
        ),
    );
}

/**
 * Largest serialized client action accepted, in bytes. Real actions are a few
 * hundred bytes at most; the cap bounds what a client can make the server
 * store in the permanent move log.
 */
export const MAX_ACTION_BYTES = 4096;

type CommitResult =
    | { ok: true; version: number }
    | { ok: false; error: "version_conflict" | "db_error"; message?: string };

/**
 * Commit one applied action atomically through `wildcard.commit_game_step`:
 * the compare-and-set on `games.version`, the secret state and the log row
 * (`seq` = new version) land in ONE transaction — all or nothing. A torn game
 * (version bumped, state or log missing) can no longer exist, so the replay
 * always re-derives the live state.
 */
async function commitStep(
    admin: Admin,
    gameId: string,
    expectedVersion: number,
    state: GameState,
    isOver: boolean,
    outcome: GameOutcome | null,
    actorId: string,
    action: GameAction,
    events: readonly GameEvent[],
): Promise<CommitResult> {
    const { data, error } = await admin.rpc("commit_game_step", {
        p_game_id: gameId,
        p_expected_version: expectedVersion,
        p_phase: state.phase,
        p_current_player_id: state.currentPlayerId,
        p_is_over: isOver,
        p_winner_ids: [...(outcome?.winners ?? [])],
        p_state: state as unknown as Record<string, unknown>,
        p_actor_id: actorId,
        p_action: action as unknown as Record<string, unknown>,
        p_events: events as unknown as Record<string, unknown>[],
    });
    if (error) return { ok: false, error: "db_error", message: error.message };
    if (data === null) return { ok: false, error: "version_conflict" };
    // Push the new version to every client on the game topic. Not awaited:
    // the doorbell must never delay the actor's response or pace the bot
    // chain, and a missed ring is caught by the clients' heartbeat poll.
    void notifyGameVersion(admin, gameId, data);
    return { ok: true, version: data };
}

/** What {@link settleGame} needs to know about a finished game. */
export interface SettleTarget {
    readonly id: string;
    readonly moduleId: string;
    readonly botIds: readonly string[];
    readonly createdAt: string | null;
    /** Moves actually played (no XP for a game nobody played). */
    readonly moveCount: number;
}

/**
 * Record the end of a finished game — exactly once. `wildcard.settle_game`
 * flips `games.settled_at` with a compare-and-set, finishes the room and applies
 * the ELO / XP computed here, in one transaction: a retried or concurrent
 * settlement is a no-op, so ratings and XP can never be granted twice.
 *
 * `forfeited` players (they left mid-game) are ranked last by the caller's
 * outcome and earn no XP. Best-effort for the caller: failures are logged and
 * the maintenance sweep ({@link settlePendingGames}) retries any game still
 * unsettled. Returns whether this call settled the game.
 */
export async function settleGame(
    admin: Admin,
    game: SettleTarget,
    outcome: GameOutcome | null,
    forfeited: readonly string[] = [],
): Promise<boolean> {
    try {
        const elo = await eloResultsForGame(
            admin,
            game.moduleId,
            outcome,
            game.botIds,
        );
        const xp = xpAwardsForGame(outcome, game.botIds, {
            excluded: forfeited,
            moveCount: game.moveCount,
        });
        const { data, error } = await admin.rpc("settle_game", {
            p_game_id: game.id,
            p_elo: elo,
            p_xp: xp,
        });
        if (error) {
            console.error(`[game] settle failed (${game.id}):`, error.message);
            return false;
        }
        if (data === true) {
            recordGameFinished(game.moduleId, durationSeconds(game.createdAt));
        }
        return data === true;
    } catch (err) {
        console.error(`[game] settle threw (${game.id}):`, err);
        return false;
    }
}

/**
 * Drive every bot whose turn it currently is, one paced move at a time, until
 * a human is on turn or the game ends. Each step is one atomic commit
 * ({@link commitStep}): it bumps `version` (so Realtime pushes the move to every
 * client), rewrites the secret state, and logs the action.
 *
 * Runs *after the response* of each human action and once at deal time (the
 * opening leader may be a bot) — see the `after()` calls at the call sites.
 * Because the chain overlaps the request window, each step claims its version
 * transition with a compare-and-set and stops if anything else won the race.
 *
 * Never throws: a module fault or a failed write is logged and stops the chain
 * (the stall self-heal in {@link maybeResumeBots} re-kicks it later) instead of
 * killing the `after()` task chain.
 *
 * Returns the final version after all bot moves.
 */
export async function advanceBots(
    admin: Admin,
    gameId: string,
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

    try {
        while (steps++ < MAX_BOT_STEPS && !module.isOver(state)) {
            const botId = nextBotMover(module, state, botSet);
            if (botId === null) break;

            const legal = module.legalActions(state, botId);
            if (legal.length === 0) break;

            // The bot "thinks" — gives every client time to animate the
            // previous play before the next version bump arrives.
            await sleep(BOT_TURN_DELAY_MS);

            const action = chooseBotAction(legal, module.riskyActions);
            const result = dispatch(module, state, action, botId);
            if (!result.ok) {
                console.error(
                    `[bots] game ${gameId}: legal bot move refused (${result.error.code})`,
                );
                break;
            }

            const over = module.isOver(result.state);
            const outcome = module.outcome(result.state);
            const committed = await commitStep(
                admin,
                gameId,
                version,
                result.state,
                over,
                outcome,
                botId,
                action,
                result.events,
            );
            if (!committed.ok) {
                // A conflict means someone else advanced the game while we
                // slept — their chain (or the next human action) owns it now.
                if (committed.error === "db_error") {
                    console.error(
                        `[bots] game ${gameId}: commit failed:`,
                        committed.message,
                    );
                }
                break;
            }
            state = result.state;
            version = committed.version;

            if (over) {
                await settleGame(
                    admin,
                    {
                        id: gameId,
                        moduleId: module.id,
                        botIds,
                        createdAt,
                        moveCount: committed.version,
                    },
                    outcome,
                );
            }
        }
    } catch (err) {
        console.error(
            `[bots] game ${gameId}: module threw, chain stopped:`,
            err,
        );
    }

    return version;
}

export type ApplyActionResult =
    | {
          ok: true;
          version: number;
          events: readonly GameEvent[];
          /**
           * The actor's fresh redacted payload, built from the just-committed
           * state. Returned in the POST response so the client adopts it
           * directly instead of firing a follow-up GET — one round-trip per
           * move instead of two, and one state load instead of two.
           */
          payload: GameClientPayload;
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
 *    and the commit is a compare-and-set (`where version = …`) so two
 *    simultaneous actions can never both commit. A loser gets
 *    `version_conflict` and simply refetches.
 * 3. The module validates legality; illegal moves are refused, never trusted.
 * 4. Meta, secret state and log row are written in one transaction
 *    ({@link commitStep}); a finished game is then settled exactly once
 *    ({@link settleGame}).
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

    // An admin abort / forfeit sets `is_over` on the row without mutating
    // `state`, so the module would still accept moves — refuse them here.
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
    // The action is stored verbatim in the move log: bound its size so a
    // client cannot pad it with arbitrary keys.
    const actionBytes = new TextEncoder().encode(JSON.stringify(action)).length;
    if (actionBytes > MAX_ACTION_BYTES) {
        record("invalid_action");
        return {
            ok: false,
            error: "invalid_action",
            message: `Action too large (${actionBytes} bytes, max ${MAX_ACTION_BYTES}).`,
        };
    }

    let result: ApplyResult<GameState>;
    let isOver: boolean;
    let outcome: GameOutcome | null;
    try {
        result = dispatch(module, state, action, actorId);
        isOver = result.ok && module.isOver(result.state);
        outcome = result.ok ? module.outcome(result.state) : null;
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
    const committed = await commitStep(
        admin,
        gameId,
        expectedVersion,
        newState,
        isOver,
        outcome,
        actorId,
        action,
        result.events,
    );
    if (!committed.ok) {
        record(committed.error);
        return committed;
    }
    const newVersion = committed.version;

    record("ok");

    // Build the actor's fresh payload straight from the in-memory committed
    // state — the client adopts it from the POST response, no follow-up GET.
    // (`logOf` now includes the action just committed.)
    const [players, log] = await Promise.all([
        playersOf(admin, newState),
        logOf(admin, gameId),
    ]);
    const payload = buildClientPayload(
        {
            ...payloadMetaOf(meta),
            version: newVersion,
            isOver,
            endReason: isOver ? "natural" : null,
            winnerIds: [...(outcome?.winners ?? [])],
        },
        module,
        newState,
        actorId,
        players,
        log,
    );

    if (isOver) {
        await settleGame(
            admin,
            {
                id: gameId,
                moduleId: meta.module_id,
                botIds: meta.bot_ids,
                createdAt: meta.created_at,
                moveCount: newVersion,
            },
            outcome,
        );
    }

    // Let any bots now on turn play out AFTER the response: the human's card
    // animates immediately, then each paced bot move arrives over Realtime as
    // its own update — visible turns instead of one burst. Skip when the game
    // already ended (no bot to play).
    if (!isOver && meta.bot_ids.length > 0) {
        after(() =>
            advanceBots(
                admin,
                gameId,
                module,
                newState,
                newVersion,
                meta.bot_ids,
                meta.created_at,
            ),
        );
    }

    return { ok: true, version: newVersion, events: result.events, payload };
}

export type EndGameResult =
    | { ok: true; version: number }
    | { ok: false; error: ApplyErrorCode };

/** Why a live game is closed out of band. */
export type OutOfBandEndReason = Exclude<GameEndReason, "natural">;

export interface EndGameOptions {
    /** Recorded in `games.end_reason`; defaults to an admin force-end. */
    readonly reason?: OutOfBandEndReason;
    /**
     * Standings to record. `null` (admin abort, reaper) = no winner, no
     * rating change; a forfeit passes the leaver-ranked-last outcome.
     */
    readonly outcome?: GameOutcome | null;
    /** The player who forfeited — ranked last by `outcome`, earns no XP. */
    readonly forfeitedBy?: string | null;
}

/** Attempts before an out-of-band end gives up racing live moves. */
const END_GAME_ATTEMPTS = 3;

/**
 * Out-of-band end of a live game: admin force-end (dashboard button), forfeit
 * (a seated player left, see `leaveRoom`) and the maintenance reaper all come
 * through here.
 *
 * This is an override, NOT a game action: it never runs the module and writes
 * no `game_actions` row (a synthetic action would break replay, which
 * re-dispatches every logged action through the module). It flips `is_over`
 * with the given winners, records why (`end_reason`, `forfeited_by`) and bumps
 * `version` — a compare-and-set, so it races cleanly against a concurrent
 * player/bot move (retried a few times against a busy bot chain) — then
 * settles the game exactly once ({@link settleGame}): room finished, ELO/XP
 * from `outcome`, finish metric. Every connected client refetches on the
 * version bump and lands on the game-over screen. A game already over is an
 * idempotent success.
 */
export async function endGame(
    admin: Admin,
    gameId: string,
    options: EndGameOptions = {},
): Promise<EndGameResult> {
    const outcome = options.outcome ?? null;
    const reason = options.reason ?? "admin";
    const forfeitedBy =
        reason === "forfeit" ? (options.forfeitedBy ?? null) : null;

    for (let attempt = 0; attempt < END_GAME_ATTEMPTS; attempt++) {
        const { data: meta, error: readError } = await admin
            .from("games")
            .select("id, module_id, version, is_over, bot_ids, created_at")
            .eq("id", gameId)
            .maybeSingle();
        if (readError) {
            console.error(`[game] end read failed (${gameId}):`, readError);
            return { ok: false, error: "db_error" };
        }
        if (!meta) return { ok: false, error: "not_found" };
        if (meta.is_over) return { ok: true, version: meta.version };

        const newVersion = meta.version + 1;
        const { data: claimed, error } = await admin
            .from("games")
            .update({
                version: newVersion,
                is_over: true,
                end_reason: reason,
                forfeited_by: forfeitedBy,
                winner_ids: [...(outcome?.winners ?? [])],
                updated_at: new Date().toISOString(),
            })
            .eq("id", gameId)
            .eq("version", meta.version)
            .eq("is_over", false)
            .select("id")
            .maybeSingle();
        if (error) {
            console.error(`[game] end failed (${gameId}):`, error.message);
            return { ok: false, error: "db_error" };
        }
        // Lost the race to a player/bot move — re-read and try again.
        if (!claimed) continue;

        await settleGame(
            admin,
            {
                id: meta.id,
                moduleId: meta.module_id,
                botIds: meta.bot_ids,
                createdAt: meta.created_at,
                // The pre-bump version: every move so far, none for this end.
                moveCount: meta.version,
            },
            outcome,
            forfeitedBy ? [forfeitedBy] : [],
        );
        return { ok: true, version: newVersion };
    }

    return { ok: false, error: "version_conflict" };
}

/**
 * Forfeit: `leaverId` walked out of a live game. The game ends at once — the
 * leaver ranked last, every remaining seat (bots included) sharing first place
 * — and is settled like any finished game (ELO among humans, XP for those who
 * stayed). A solo game simply ends without a result. No-op when the game is
 * already over or the leaver was not dealt in (a spectator).
 */
export async function forfeitGame(
    admin: Admin,
    gameId: string,
    leaverId: string,
): Promise<EndGameResult> {
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) return loaded;
    const { meta, state } = loaded.game;
    if (meta.is_over) return { ok: true, version: meta.version };
    const playerIds = state.players.map((p) => p.id);
    if (!playerIds.includes(leaverId)) {
        return { ok: true, version: meta.version };
    }

    const outcome = outcomeFromWinners(
        playerIds,
        playerIds.filter((id) => id !== leaverId),
        leaverId,
    );

    return endGame(admin, gameId, {
        reason: "forfeit",
        outcome,
        forfeitedBy: leaverId,
    });
}

/** Max games one {@link settlePendingGames} pass settles. */
const SETTLE_BATCH = 100;

/**
 * Settle finished games whose settlement never landed (the process died between
 * the final commit and {@link settleGame}, or the settle call failed). Idempotent
 * — run by the maintenance pass at boot. Returns how many games this pass
 * settled.
 *
 * The outcome is rebuilt exactly as the original settlement computed it
 * ({@link resolveEndOutcome}): from the terminal state for a natural end, from
 * the stored winners (forfeiter last) for a forfeit, none for an admin / reaper
 * close — so a retried forfeit still grants its ELO / XP.
 *
 * Only rows carrying an `end_reason` are retried: that column is written by the
 * current code path only, so a game ended by an older instance during a rolling
 * deploy (settled the old way, `settled_at` never set) is never settled twice.
 */
export async function settlePendingGames(admin: Admin): Promise<number> {
    const { data: pending, error } = await admin
        .from("games")
        .select("id")
        .eq("is_over", true)
        .is("settled_at", null)
        .not("end_reason", "is", null)
        .limit(SETTLE_BATCH);
    if (error) {
        console.error("[game] pending settlements read failed:", error.message);
        return 0;
    }

    let settled = 0;
    for (const { id } of pending ?? []) {
        const loaded = await loadGame(admin, id);
        if (!loaded.ok) continue;
        const { meta, module, state } = loaded.game;
        let terminal = false;
        let stateOutcome: GameOutcome | null = null;
        try {
            terminal = module.isOver(state);
            stateOutcome = terminal ? module.outcome(state) : null;
        } catch (err) {
            console.error(`[game] outcome threw (${id}):`, err);
        }
        const outcome = resolveEndOutcome({
            reason: meta.end_reason,
            terminal,
            stateOutcome,
            playerIds: state.players.map((p) => p.id),
            winnerIds: meta.winner_ids,
            forfeitedBy: meta.forfeited_by,
        });
        const done = await settleGame(
            admin,
            {
                id,
                moduleId: meta.module_id,
                botIds: meta.bot_ids,
                createdAt: meta.created_at,
                moveCount: playedMoves(meta.version, terminal),
            },
            outcome,
            meta.forfeited_by ? [meta.forfeited_by] : [],
        );
        if (done) settled++;
    }
    return settled;
}
