import { after } from "next/server";
import { dispatch } from "@/lib/engine/runner";
import type {
    ApplyResult,
    GameAction,
    GameEvent,
    GameOutcome,
    GameState,
    RuleViolation,
} from "@/lib/engine/types";
import { recordMove } from "@/lib/metrics/registry";
import type { AdminClient } from "@/lib/supabase/admin";
import { advanceBots } from "./bots";
import { commitStep } from "./commit";
import type { GameErrorCode } from "./errors";
import { loadGame } from "./load";
import {
    buildClientPayload,
    type GameClientPayload,
    logOf,
    payloadMetaOf,
    playersOf,
} from "./payload";
import { settleGame } from "./settle";

/** Bounds what a client can make the server store in the permanent move log. */
const MAX_ACTION_BYTES = 4096;

export type ApplyActionResult =
    | {
          ok: true;
          version: number;
          events: readonly GameEvent[];
          /** The actor's fresh payload, so the client needs no follow-up GET. */
          payload: GameClientPayload;
      }
    | {
          ok: false;
          error: GameErrorCode;
          violation?: RuleViolation;
          message?: string;
      };

/**
 * Server-authoritative move: the actor is forced to the authenticated user,
 * `expectedVersion` is compare-and-set at commit, the module decides legality.
 */
export async function applyAction(
    admin: AdminClient,
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
    const record = (result: string) =>
        recordMove(meta.module_id, result, performance.now() - startedAt);

    // An out-of-band end leaves `state` non-terminal: the module would still accept moves.
    if (meta.is_over) {
        record("rule_violation");
        return {
            ok: false,
            error: "rule_violation",
            violation: { code: "game_over", message: "game_over" },
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

    const action = { ...rawAction, playerId: actorId } as GameAction;
    const actionBytes = new TextEncoder().encode(JSON.stringify(action)).length;
    if (actionBytes > MAX_ACTION_BYTES) {
        record("invalid_action");
        return {
            ok: false,
            error: "invalid_action",
            message: `action_too_large (${actionBytes} > ${MAX_ACTION_BYTES} bytes)`,
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
    } else if (meta.bot_ids.length > 0) {
        // After the response: the human's card animates first, then each bot move.
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
