import type { GameOutcome } from "@/lib/engine/types";
import { recordGameFinished } from "@/lib/metrics/registry";
import { eloResultsForGame } from "@/lib/models/elo";
import {
    outcomeFromWinners,
    playedMoves,
    resolveEndOutcome,
} from "@/lib/models/gameEnd";
import { xpAwardsForGame } from "@/lib/models/xp";
import { notifyGameVersion } from "@/lib/realtime/notifyGameVersion";
import type { AdminClient } from "@/lib/supabase/admin";
import type { GameEndReason } from "@/lib/supabase/types";
import type { GameErrorCode } from "./errors";
import { loadGame } from "./load";

export interface SettleTarget {
    readonly id: string;
    readonly moduleId: string;
    readonly botIds: readonly string[];
    readonly createdAt: string | null;
    /** Moves actually played (no XP for a game nobody played). */
    readonly moveCount: number;
}

function durationSeconds(createdAt: string | null): number {
    if (!createdAt) return -1;
    return (Date.now() - new Date(createdAt).getTime()) / 1000;
}

/**
 * Record the end of a finished game exactly once: `wildcard.settle_game`
 * compare-and-sets `settled_at`, finishes the room and applies ELO/XP in one
 * transaction. Never throws; a failure is retried by {@link settlePendingGames}.
 * `forfeited` players earn no XP. Returns whether this call settled the game.
 */
export async function settleGame(
    admin: AdminClient,
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
        if (!elo.ok) return false;
        const xp = xpAwardsForGame(outcome, game.botIds, {
            moduleId: game.moduleId,
            excluded: forfeited,
            moveCount: game.moveCount,
        });
        const { data, error } = await admin.rpc("settle_game", {
            p_game_id: game.id,
            p_elo: elo.rows,
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

export type EndGameResult =
    | { ok: true; version: number }
    | { ok: false; error: GameErrorCode };

export type OutOfBandEndReason = Exclude<GameEndReason, "natural">;

export interface EndGameOptions {
    readonly reason?: OutOfBandEndReason;
    /** `null` (admin, reaper) = no winner, no rating change. */
    readonly outcome?: GameOutcome | null;
    readonly forfeitedBy?: string | null;
}

const END_GAME_ATTEMPTS = 3;

/**
 * Out-of-band end (admin, forfeit, reaper). Not a game action: it never runs
 * the module and logs nothing, since a synthetic action would break replay.
 * Flips `is_over` with a version compare-and-set (retried against a busy bot
 * chain), rings the doorbell, then settles. Idempotent on a finished game.
 */
export async function endGame(
    admin: AdminClient,
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
        if (!claimed) continue; // lost the race to a move: re-read

        void notifyGameVersion(admin, gameId, newVersion);
        await settleGame(
            admin,
            {
                id: meta.id,
                moduleId: meta.module_id,
                botIds: meta.bot_ids,
                createdAt: meta.created_at,
                moveCount: meta.version, // pre-bump: this end is not a move
            },
            outcome,
            forfeitedBy ? [forfeitedBy] : [],
        );
        return { ok: true, version: newVersion };
    }

    return { ok: false, error: "version_conflict" };
}

/**
 * `leaverId` walked out: the game ends at once, leaver last and every other
 * seat sharing first place. No-op when over or the leaver was not dealt in.
 */
export async function forfeitGame(
    admin: AdminClient,
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

    return endGame(admin, gameId, {
        reason: "forfeit",
        outcome: outcomeFromWinners(
            playerIds,
            playerIds.filter((id) => id !== leaverId),
            leaverId,
        ),
        forfeitedBy: leaverId,
    });
}

const SETTLE_BATCH = 100;

/**
 * Settle finished games whose settlement never landed, rebuilding the outcome
 * as the original settlement did. Only rows with an `end_reason` are retried:
 * older code never wrote it and settled those games its own way.
 */
export async function settlePendingGames(admin: AdminClient): Promise<number> {
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
    for (const { id } of pending) {
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
        const done = await settleGame(
            admin,
            {
                id,
                moduleId: meta.module_id,
                botIds: meta.bot_ids,
                createdAt: meta.created_at,
                moveCount: playedMoves(meta.version, terminal),
            },
            resolveEndOutcome({
                reason: meta.end_reason,
                terminal,
                stateOutcome,
                playerIds: state.players.map((p) => p.id),
                winnerIds: meta.winner_ids,
                forfeitedBy: meta.forfeited_by,
            }),
            meta.forfeited_by ? [meta.forfeited_by] : [],
        );
        if (done) settled++;
    }
    return settled;
}
