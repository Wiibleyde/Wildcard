import { type ApiErrorKey, apiErrorKey } from "@/lib/api/errorKeys";
import type { GameOutcome } from "@/lib/engine/types";
import type {
    GameClientPayload,
    GameFrame,
    GameLogEntry,
} from "@/lib/models/game";
import type { ReplayPayload } from "@/lib/models/replay";

type GameErrorKey =
    | "error_illegal"
    | "error_conflict"
    | "error_no_access"
    | "error_leave_failed";

/** Full dictionary path: in-game wording where it differs, else the shared `errors`. */
export type ActionErrorKey = `game.${GameErrorKey}` | `errors.${ApiErrorKey}`;

/** For bodies without an `error` code (e.g. a proxy's 413). */
const STATUS_CODES: Partial<Record<number, string>> = {
    413: "payload_too_large",
    429: "rate_limited",
    503: "maintenance",
};

export function actionErrorKey(
    status: number,
    code: string | null = null,
): ActionErrorKey {
    if (status === 422) return "game.error_illegal";
    if (status === 409) return "game.error_conflict";
    if (status === 403 || status === 404) return "game.error_no_access";
    return `errors.${apiErrorKey(code ?? STATUS_CODES[status])}`;
}

type BoardBase = Pick<
    GameClientPayload,
    "gameId" | "moduleId" | "roomCode" | "players" | "botIds" | "viewerId"
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
        botIds: base.botIds,
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
