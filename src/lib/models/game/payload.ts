import { clientState, persistedRules, replayFrames } from "@/lib/engine/runner";
import type {
    AnyGameModule,
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
} from "@/lib/engine/types";
import { fromJson } from "@/lib/json";
import { DEFAULT_DECK_STYLE } from "@/lib/models/customization";
import {
    describeEnd,
    type GameEndInfo,
    resolveEndOutcome,
} from "@/lib/models/gameEnd";
import type { AdminClient } from "@/lib/supabase/admin";
import type { GameEndReason } from "@/lib/supabase/types";
import { isStallCandidate, maybeResumeBots } from "./bots";
import { type GameMeta, type LoadError, loadGame } from "./load";

export interface GamePlayer {
    readonly userId: string;
    readonly username: string;
    readonly seat: number;
    /** Every viewer renders this player's cards in their own deck style. */
    readonly deckStyleId: string;
}

/** Events are public by module contract, so every viewer gets the same log. */
export interface GameLogEntry {
    readonly seq: number;
    readonly actorId: string;
    readonly events: readonly GameEvent[];
}

const LOG_LIMIT = 80;

/** One viewer's redacted payload: `view` is the module projection, never raw state. */
export interface GameClientPayload {
    readonly gameId: string;
    readonly moduleId: string;
    readonly roomCode: string | null;
    readonly version: number;
    readonly phase: string;
    readonly isOver: boolean;
    readonly currentPlayerId: string | null;
    readonly view: unknown;
    readonly legalActions: readonly GameAction[];
    /** Module outcome, or rebuilt from stored winners for a forfeit; null for admin/reaper ends. */
    readonly outcome: GameOutcome | null;
    readonly end: GameEndInfo | null;
    readonly players: readonly GamePlayer[];
    readonly log: readonly GameLogEntry[];
    /** `null` = spectator. */
    readonly viewerId: string | null;
}

/** The viewer's board right after move `version`, for move-by-move catch-up. */
export interface GameFrame {
    readonly version: number;
    readonly phase: string;
    readonly currentPlayerId: string | null;
    readonly view: unknown;
}

export interface GameSyncPayload extends GameClientPayload {
    readonly frames: readonly GameFrame[];
}

/** A client further behind only plays the tail, not a minute of animations. */
const MAX_CATCHUP_FRAMES = 8;

export async function playersOf(
    admin: AdminClient,
    state: GameState,
): Promise<GamePlayer[]> {
    const { data } = await admin
        .from("player_customizations")
        .select("user_id, deck_style_id")
        .in(
            "user_id",
            state.players.map((p) => p.id),
        );
    const styles = new Map(
        (data ?? []).map((row) => [row.user_id, row.deck_style_id]),
    );
    return state.players.map((p) => ({
        userId: p.id,
        username: p.name,
        seat: p.seat,
        deckStyleId: styles.get(p.id) ?? DEFAULT_DECK_STYLE,
    }));
}

export async function logOf(
    admin: AdminClient,
    gameId: string,
): Promise<GameLogEntry[]> {
    const { data } = await admin
        .from("game_actions")
        .select("seq, actor_id, events")
        .eq("game_id", gameId)
        .order("seq", { ascending: false })
        .limit(LOG_LIMIT);
    return (data ?? []).reverse().map((row) => ({
        seq: row.seq,
        actorId: row.actor_id,
        events: fromJson<readonly GameEvent[]>(row.events),
    }));
}

export interface PayloadMeta {
    readonly gameId: string;
    readonly moduleId: string;
    readonly roomCode: string | null;
    readonly version: number;
    /** An out-of-band end flips it without touching `state`. */
    readonly isOver: boolean;
    readonly endReason: GameEndReason | null;
    readonly forfeitedBy: string | null;
    readonly winnerIds: readonly string[];
    readonly botIds: readonly string[];
}

export function payloadMetaOf(meta: GameMeta): PayloadMeta {
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

export function buildClientPayload(
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
            moduleId: meta.moduleId,
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
        // A force-ended state is non-terminal: the module would still list moves.
        legalActions: isOver ? [] : cs.legalActions,
        outcome,
        end,
        players,
        log,
        viewerId,
    };
}

/** An unseated `viewerId` is treated as a spectator. */
export async function getGameClientState(
    admin: AdminClient,
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

/** `since` = last version the client holds (`null` = no catch-up). */
export async function getGameSync(
    admin: AdminClient,
    gameId: string,
    viewerId: string | null,
    since: number | null,
): Promise<
    { ok: true; payload: GameSyncPayload } | { ok: false; error: LoadError }
> {
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) return loaded;
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
 * Boards strictly between `since` and `head`, re-derived from the log (only
 * the head is stored) and redacted through `view()`. Cosmetic: on any doubt
 * it returns nothing and the client jumps to the head.
 */
async function catchUpFrames(
    admin: AdminClient,
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
    if (rows.length !== head || rows.some((r, i) => r.seq !== i + 1)) {
        return [];
    }

    const out: GameFrame[] = [];
    try {
        const frames = replayFrames(
            module,
            state.players,
            state.seed,
            rows.map((r) => fromJson<GameAction>(r.action)),
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
 * The poll/doorbell probe: public meta only. The heavy state load needed to
 * confirm a stranded bot chain happens only once the row has gone stale.
 */
export async function getGameVersion(
    admin: AdminClient,
    gameId: string,
): Promise<
    | { ok: true; info: GameVersionInfo }
    | { ok: false; error: "not_found" | "db_error" }
> {
    const { data: meta, error } = await admin
        .from("games")
        .select("version, is_over, bot_ids, current_player_id, updated_at")
        .eq("id", gameId)
        .maybeSingle();
    if (error) {
        console.error(`[game] version read failed (${gameId}):`, error.message);
        return { ok: false, error: "db_error" };
    }
    if (!meta) return { ok: false, error: "not_found" };

    if (isStallCandidate(meta)) {
        const loaded = await loadGame(admin, gameId);
        if (loaded.ok) maybeResumeBots(admin, loaded.game);
    }

    return {
        ok: true,
        info: { version: meta.version, isOver: meta.is_over },
    };
}
