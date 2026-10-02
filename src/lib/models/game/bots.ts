import { after } from "next/server";
import { dispatch } from "@/lib/engine/runner";
import type { AnyGameModule, GameAction, GameState } from "@/lib/engine/types";
import type { AdminClient } from "@/lib/supabase/admin";
import { commitStep } from "./commit";
import type { GameMeta, LoadedGame } from "./load";
import { settleGame } from "./settle";

/**
 * Deliberately simple: never gamble on `riskyActions`, prefer acting over
 * passing, else random. Non-deterministic, but every move is logged, so replay
 * stays exact.
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
 * Moves one `after()` run plays before yielding, so a long all-bot game does
 * not pin one task for minutes; {@link maybeResumeBots} picks the chain back up.
 */
const BOT_STEPS_PER_RUN = 120;

/** One move per version bump, so every client animates each card. */
const BOT_TURN_DELAY_MS = 900;

/** Well above one paced move, so a live chain is never double-driven. */
const STALL_RESUME_MS = 3000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The bot to move next, or `null` if a human owns the turn. Simultaneous games
 * (`currentPlayerId` null) are driven only when every player with a legal move
 * is a bot, so a table with a human waits for them.
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

/** Cheap meta-only test: could a bot chain be stranded on this game? */
export function isStallCandidate(
    meta: Pick<
        GameMeta,
        "is_over" | "bot_ids" | "current_player_id" | "updated_at"
    >,
): boolean {
    if (meta.is_over || meta.bot_ids.length === 0) return false;
    const maybeBotTurn =
        meta.current_player_id === null ||
        meta.bot_ids.includes(meta.current_player_id);
    const idleMs = Date.now() - new Date(meta.updated_at).getTime();
    return maybeBotTurn && idleMs >= STALL_RESUME_MS;
}

/**
 * Re-launch a bot chain lost mid-turn (the `after()` task died with its
 * invocation, or yielded). Safe on every read: racing kicks collapse to one
 * live chain through the per-step compare-and-set.
 */
export function maybeResumeBots(admin: AdminClient, game: LoadedGame): void {
    const { meta, module, state } = game;
    if (!isStallCandidate(meta)) return;
    try {
        if (module.isOver(state)) return;
        if (nextBotMover(module, state, new Set(meta.bot_ids)) === null) return;
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
 * Play every bot on turn, one paced atomic commit at a time, until a human is
 * on turn, the game ends, or the run's step budget is spent. Runs after the
 * response, so each step compare-and-sets and stops when anything else wins.
 * Never throws. Returns the final version.
 */
export async function advanceBots(
    admin: AdminClient,
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

    try {
        for (
            let step = 0;
            step < BOT_STEPS_PER_RUN && !module.isOver(state);
            step++
        ) {
            const botId = nextBotMover(module, state, botSet);
            if (botId === null) break;

            const legal = module.legalActions(state, botId);
            if (legal.length === 0) break;

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
                // A conflict means another chain or a human owns the game now.
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
