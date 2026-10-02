import { describe, expect, it } from "vitest";
import type { GameClientPayload } from "@/lib/models/game";
import type { ReplayPayload } from "@/lib/models/replay";
import { actionErrorKey, frameBoard, replayBoard } from "./gamePayload";
import { buildLogLines } from "./logLines";

const head: GameClientPayload = {
    gameId: "g",
    moduleId: "bataille",
    roomCode: "ABCD",
    version: 3,
    phase: "play",
    isOver: true,
    currentPlayerId: null,
    view: { at: 3 },
    legalActions: [{ type: "play", playerId: "a" }],
    outcome: { winners: ["a"], rankings: [] },
    end: null,
    players: [],
    log: [1, 2, 3].map((seq) => ({ seq, actorId: "a", events: [] })),
    viewerId: "a",
};

describe("frameBoard", () => {
    it("shows the frame's view as a non-actionable, non-final board", () => {
        const board = frameBoard(head, {
            version: 2,
            phase: "play",
            currentPlayerId: "b",
            view: { at: 2 },
        });
        expect(board.view).toEqual({ at: 2 });
        expect(board.currentPlayerId).toBe("b");
        expect(board.legalActions).toEqual([]);
        expect(board.isOver).toBe(false);
        expect(board.outcome).toBeNull();
        expect(board.log.map((e) => e.seq)).toEqual([1, 2]);
        expect(board.roomCode).toBe("ABCD");
    });
});

describe("replayBoard", () => {
    const replay: ReplayPayload = {
        gameId: "g",
        moduleId: "bataille",
        viewerId: "a",
        players: [],
        steps: [0, 1, 2].map((i) => ({
            view: { at: i },
            phase: "play",
            currentPlayerId: "a",
            isOver: i === 2,
            outcome: null,
            actorId: i === 0 ? null : "a",
            events: i === 0 ? [] : [{ type: `e${i}` }],
        })),
        interruptedBy: null,
        forfeitedBy: null,
        expired: false,
        diverged: false,
    };

    it("rebuilds the log up to the step and never carries the settlement", () => {
        const board = replayBoard(replay, 2);
        expect(board.version).toBe(2);
        expect(board.isOver).toBe(true);
        expect(board.end).toBeNull();
        expect(board.roomCode).toBeNull();
        expect(board.log.map((e) => e.seq)).toEqual([1, 2]);
    });

    it("frame 0 is the deal with an empty log", () => {
        expect(replayBoard(replay, 0).log).toEqual([]);
    });
});

describe("actionErrorKey", () => {
    it("keeps in-game wording for move outcomes", () => {
        expect(actionErrorKey(422, "illegal_move")).toBe("game.error_illegal");
        expect(actionErrorKey(404)).toBe("game.error_no_access");
    });

    it("maps the rest to the shared errors namespace", () => {
        expect(actionErrorKey(429, "rate_limited")).toBe("errors.rate_limited");
        expect(actionErrorKey(413)).toBe("errors.payload_too_large");
        expect(actionErrorKey(401, "token_expired")).toBe(
            "errors.unauthorized",
        );
        expect(actionErrorKey(500)).toBe("errors.generic");
    });
});

describe("buildLogLines", () => {
    it("orders newest first, within an entry too, and drops hidden events", () => {
        const lines = buildLogLines(
            [
                { seq: 1, actorId: "a", events: [{ type: "x" }] },
                {
                    seq: 2,
                    actorId: "a",
                    events: [{ type: "x" }, { type: "hidden" }, { type: "y" }],
                },
            ],
            (e) => (e.type === "hidden" ? null : e.type),
        );
        expect(lines).toEqual([
            { id: "2.2", text: "y" },
            { id: "2.0", text: "x" },
            { id: "1.0", text: "x" },
        ]);
    });
});
