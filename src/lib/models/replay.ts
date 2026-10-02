import { persistedRules, replayFrames } from "@/lib/engine/runner";
import type {
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
} from "@/lib/engine/types";
import { fromJson } from "@/lib/json";
import type { AdminClient } from "@/lib/supabase/admin";
import type { GameEndReason } from "@/lib/supabase/types";
import { type LoadError, loadGame } from "./game/load";
import { type GamePlayer, playersOf } from "./game/payload";

/** The board exactly as it stood after one move. */
export interface ReplayStep {
    /** Redacted for the viewer — never raw state. */
    readonly view: unknown;
    readonly phase: string;
    readonly currentPlayerId: string | null;
    readonly isOver: boolean;
    readonly outcome: GameOutcome | null;
    /** `null` for the opening deal (frame 0). */
    readonly actorId: string | null;
    readonly events: readonly GameEvent[];
}

export interface ReplayPayload {
    readonly gameId: string;
    readonly moduleId: string;
    readonly viewerId: string | null;
    readonly players: readonly GamePlayer[];
    readonly botIds: readonly string[];
    /** Frame 0 = initial deal, then one per logged action. */
    readonly steps: readonly ReplayStep[];
    /** Set when the game was closed out of band before a terminal position. */
    readonly interruptedBy: Exclude<GameEndReason, "natural"> | null;
    readonly forfeitedBy: string | null;
    /** Move log pruned by retention, or incomplete. */
    readonly expired: boolean;
    /** The log does not re-derive the recorded game; `steps` holds the clean prefix. */
    readonly diverged: boolean;
}

/** jsonb reorders keys and drops `undefined`, so compare canonical JSON. */
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

/**
 * The runner owns `turn` and `rngState`: legacy rows may carry a stale cursor
 * or a turn counted by a module's old rules, neither of which is a divergence.
 */
export function matchesRecorded(
    replayed: GameState,
    recorded: GameState,
): boolean {
    return sameJson(
        { ...replayed, rngState: null, turn: null },
        { ...recorded, rngState: null, turn: null },
    );
}

function isCompleteLog(seqs: readonly number[]): boolean {
    return seqs.every((seq, i) => seq === i + 1);
}

/**
 * Re-derive a finished game frame by frame from `(seed, rules, action log)`
 * and project each frame through `view()`. Integrity is checked, not assumed.
 * Participants only; anything else (live game included) is `not_found`, so a
 * game id's existence is never confirmed.
 */
export async function getReplay(
    admin: AdminClient,
    gameId: string,
    viewerId: string | null,
): Promise<
    { ok: true; payload: ReplayPayload } | { ok: false; error: LoadError }
> {
    const loaded = await loadGame(admin, gameId);
    if (!loaded.ok) return loaded;
    const { meta, module, state: finalState } = loaded.game;

    if (!meta.is_over) return { ok: false, error: "not_found" };
    if (
        viewerId === null ||
        !finalState.players.some((p) => p.id === viewerId)
    ) {
        return { ok: false, error: "not_found" };
    }

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

    // A pruned or holed log could only show a misleading prefix.
    const expired =
        meta.actions_pruned_at !== null ||
        logError !== null ||
        !isCompleteLog(actions.map((r) => r.seq));

    const folded = expired ? [] : actions;
    const steps: ReplayStep[] = [];
    let lastState: GameState | null = null;
    let diverged = false;
    try {
        const frames = replayFrames(
            module,
            finalState.players,
            finalState.seed,
            folded.map((r) => fromJson<GameAction>(r.action)),
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
                view: module.view(state, viewerId),
                phase: state.phase,
                currentPlayerId: state.currentPlayerId,
                isOver: module.isOver(state),
                outcome: module.outcome(state),
                actorId: index < 0 ? null : folded[index].actor_id,
                events:
                    index < 0
                        ? events
                        : fromJson<GameEvent[]>(folded[index].events ?? []),
            });
        }
    } catch (err) {
        diverged = true;
        console.error(`[replay] game ${gameId}: module threw:`, err);
    }
    if (
        !expired &&
        !diverged &&
        lastState &&
        !matchesRecorded(lastState, finalState)
    ) {
        diverged = true;
        console.error(
            `[replay] game ${gameId}: final state does not match the log`,
        );
    }

    if (steps.length === 0) return { ok: false, error: "unknown_game" };

    let terminal = false;
    try {
        terminal = module.isOver(finalState);
    } catch {
        terminal = false;
    }
    // A natural end must land on a terminal state; otherwise the record is inconsistent.
    if (meta.end_reason === "natural" && !terminal) diverged = true;

    return {
        ok: true,
        payload: {
            gameId: meta.id,
            moduleId: meta.module_id,
            viewerId,
            players: await playersOf(admin, finalState),
            botIds: meta.bot_ids,
            steps,
            // A legacy row (null reason) keeps the old "admin" label.
            // A non-terminal natural end is flagged `diverged` above instead.
            interruptedBy:
                terminal || meta.end_reason === "natural"
                    ? null
                    : (meta.end_reason ?? "admin"),
            forfeitedBy: meta.forfeited_by,
            expired,
            diverged,
        },
    };
}
