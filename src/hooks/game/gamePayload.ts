import type { GameOutcome } from "@/lib/engine/types";
import type {
    GameClientPayload,
    GameFrame,
    GameLogEntry,
} from "@/lib/models/game";
import type { ReplayPayload } from "@/lib/models/replay";

export type ActionErrorKey =
    | "error_illegal"
    | "error_conflict"
    | "error_generic"
    | "error_rate_limited"
    | "error_maintenance"
    | "error_payload_too_large"
    | "error_no_access"
    | "error_leave_failed";

export function statusToErrorKey(status: number): ActionErrorKey {
    if (status === 422) return "error_illegal";
    if (status === 409) return "error_conflict";
    if (status === 429) return "error_rate_limited";
    if (status === 503) return "error_maintenance";
    if (status === 413) return "error_payload_too_large";
    if (status === 403 || status === 404) return "error_no_access";
    return "error_generic";
}

type BoardBase = Pick<
    GameClientPayload,
    "gameId" | "moduleId" | "roomCode" | "players" | "viewerId"
>;

interface BoardFrame extends GameFrame {
    readonly isOver?: boolean;
    readonly outcome?: GameOutcome | null;
}

// A past board is never actionable and never shows the settlement (XP).
function boardAt(
    base: BoardBase,
    frame: BoardFrame,
    log: readonly GameLogEntry[],
): GameClientPayload {
    return {
        gameId: base.gameId,
        moduleId: base.moduleId,
        roomCode: base.roomCode,
        players: base.players,
        viewerId: base.viewerId,
        version: frame.version,
        phase: frame.phase,
        currentPlayerId: frame.currentPlayerId,
        view: frame.view,
        legalActions: [],
        isOver: frame.isOver ?? false,
        outcome: frame.outcome ?? null,
        end: null,
        log,
    };
}

/** Intermediate live board for move-by-move playback; only the head can be the end. */
export function frameBoard(
    head: GameClientPayload,
    frame: GameFrame,
): GameClientPayload {
    return boardAt(
        head,
        frame,
        head.log.filter((entry) => entry.seq <= frame.version),
    );
}

/** Board at replay step `index`; the caller guarantees the step exists. */
export function replayBoard(
    replay: ReplayPayload,
    index: number,
): GameClientPayload {
    const step = replay.steps[index];
    const log = replay.steps.slice(1, index + 1).map((s, i) => ({
        seq: i + 1,
        actorId: s.actorId ?? "",
        events: s.events,
    }));
    return boardAt(
        { ...replay, roomCode: null },
        { ...step, version: index },
        log,
    );
}
