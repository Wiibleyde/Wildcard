"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransientNotice } from "@/hooks/game/useTransientNotice";
import { apiFetch } from "@/lib/api/client";
import type { GameAction } from "@/lib/engine/types";
import type { AnyGameTableConfig } from "@/lib/games/table/types";
import type { GameClientPayload, GameSyncPayload } from "@/lib/models/game";
import { useGameChannel } from "@/lib/realtime/useGameChannel";
import type { RealtimeStatus } from "@/lib/realtime/useRealtimeSync";
import {
    type ActionErrorKey,
    frameBoard,
    statusToErrorKey,
} from "./gamePayload";

// Just over the longest card landing (0.55s), under the server's bot pacing (900ms).
const FRAME_MS = 650;

export interface GameSync {
    payload: GameClientPayload;
    pending: boolean;
    setPending: (pending: boolean) => void;
    actionError: ActionErrorKey | null;
    showError: (key: ActionErrorKey, ms: number) => void;
    conn: RealtimeStatus;
    onAction: (action: GameAction) => Promise<void>;
}

/**
 * Live game state: doorbell-driven catch-up, move-by-move playback queue,
 * optimistic own moves with rollback.
 */
export function useGameSync(
    gameId: string,
    initial: GameClientPayload,
    table: AnyGameTableConfig | undefined,
    userId: string,
): GameSync {
    const [payload, setPayload] = useState<GameClientPayload>(initial);
    const [pending, setPending] = useState(false);
    const [actionError, showError] = useTransientNotice<ActionErrorKey>();
    // Highest version held, on screen or queued; a ref so the doorbell
    // callbacks don't churn with `payload`.
    const versionRef = useRef(initial.version);
    const payloadRef = useRef(payload);
    payloadRef.current = payload;

    const queueRef = useRef<GameClientPayload[]>([]);
    const shownAtRef = useRef(0);
    const timerRef = useRef<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        abortRef.current = controller;
        return () => {
            controller.abort();
            abortRef.current = null;
            if (timerRef.current !== null) clearTimeout(timerRef.current);
            timerRef.current = null;
        };
    }, []);

    const alive = useCallback(
        () => abortRef.current !== null && !abortRef.current.signal.aborted,
        [],
    );
    const get = useCallback(
        (url: `/api/${string}`, init?: RequestInit) =>
            apiFetch(url, {
                cache: "no-store",
                ...init,
                signal: abortRef.current?.signal,
            }),
        [],
    );

    const show = useCallback((next: GameClientPayload) => {
        shownAtRef.current = Date.now();
        setPayload(next);
    }, []);

    const pump = useCallback(
        function pumpQueue() {
            if (timerRef.current !== null || queueRef.current.length === 0) {
                return;
            }
            const wait = Math.max(
                0,
                shownAtRef.current + FRAME_MS - Date.now(),
            );
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                if (!alive()) return;
                const next = queueRef.current.shift();
                if (next) show(next);
                pumpQueue();
            }, wait);
        },
        [alive, show],
    );

    const enqueue = useCallback(
        (boards: readonly GameClientPayload[]) => {
            for (const board of boards) {
                if (board.version <= versionRef.current) continue;
                versionRef.current = board.version;
                queueRef.current.push(board);
            }
            pump();
        },
        [pump],
    );

    // `force` adopts an equal version too: only the server's view can clear a
    // failed prediction made at an unchanged version.
    const adoptNow = useCallback(
        (next: GameClientPayload, force = false) => {
            if (!force && next.version <= versionRef.current) return;
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            queueRef.current = [];
            versionRef.current = next.version;
            show(next);
        },
        [show],
    );

    const refetchFull = useCallback(
        async (force = false) => {
            const res = await get(`/api/games/${gameId}`);
            if (!alive()) return;
            if (!res.ok) {
                // Other failures stay silent: the next poll retries.
                if (res.status === 404) showError("error_no_access", 5000);
                return;
            }
            const next = (await res.json()) as GameClientPayload;
            if (alive()) adoptNow(next, force);
        },
        [gameId, get, alive, adoptNow, showError],
    );

    // Rings arriving mid-read only raise the target, so the double ring
    // (Broadcast + CDC) of one move costs a single request.
    const inFlightRef = useRef(false);
    const wantedRef = useRef(0);
    const catchUp = useCallback(
        async (target: number) => {
            wantedRef.current = Math.max(wantedRef.current, target);
            if (inFlightRef.current) return;
            inFlightRef.current = true;
            try {
                while (wantedRef.current > versionRef.current) {
                    const before = versionRef.current;
                    const res = await get(
                        `/api/games/${gameId}?since=${before}`,
                    );
                    if (!alive()) return;
                    if (!res.ok) {
                        if (res.status === 404) {
                            showError("error_no_access", 5000);
                        }
                        return;
                    }
                    const { frames, ...head } =
                        (await res.json()) as GameSyncPayload;
                    if (!alive()) return;
                    enqueue([
                        ...(frames ?? []).map((f) => frameBoard(head, f)),
                        head,
                    ]);
                    // A forged/stale ring announcing a version the server lacks must not loop.
                    if (versionRef.current === before) return;
                }
            } catch {
                // Network blip: the next ring or heartbeat retries.
            } finally {
                inFlightRef.current = false;
            }
        },
        [gameId, get, alive, enqueue, showError],
    );

    // While our own action is in flight its response brings the new board:
    // rings are parked and replayed after. A bare resync parks as +∞.
    const actingRef = useRef(false);
    const parkedRef = useRef(0);
    const sync = useCallback(
        async (announced?: number) => {
            if (actingRef.current) {
                parkedRef.current = Math.max(
                    parkedRef.current,
                    announced ?? Number.POSITIVE_INFINITY,
                );
                return;
            }
            if (announced !== undefined) {
                if (announced > versionRef.current) await catchUp(announced);
                return;
            }
            try {
                const res = await get(`/api/games/${gameId}/version`);
                if (!alive() || !res.ok) return;
                const info = (await res.json()) as { version: number };
                if (alive() && info.version > versionRef.current) {
                    await catchUp(info.version);
                }
            } catch {
                // Offline: the reconnect resync covers it.
            }
        },
        [gameId, get, alive, catchUp],
    );

    // Off-channel fallback: slow on your turn (nobody else can act), fast otherwise.
    const myTurn =
        payload.currentPlayerId !== null && payload.currentPlayerId === userId;
    const conn = useGameChannel(gameId, sync, myTurn ? 4000 : 1000);

    const onAction = useCallback(
        async (action: GameAction) => {
            if (actingRef.current) return;
            const snapshot = payloadRef.current;
            actingRef.current = true;
            parkedRef.current = 0;
            // `null` = a move the client can't safely guess (hidden reveal): wait for the server.
            const predicted = table?.predict
                ? (table.predict(snapshot.view, action, userId) ?? null)
                : null;

            if (predicted !== null) {
                // Blank the turn so the board offers nothing to click until reconciled.
                show({
                    ...snapshot,
                    view: predicted,
                    legalActions: [],
                    currentPlayerId: null,
                });
            } else {
                setPending(true);
            }

            try {
                const res = await get(`/api/games/${gameId}/actions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        version: snapshot.version,
                        action,
                    }),
                });
                if (!alive()) return;
                if (res.ok) {
                    const data = (await res.json().catch(() => ({}))) as {
                        payload?: GameClientPayload;
                    };
                    if (!alive()) return;
                    if (data.payload) adoptNow(data.payload);
                    else await refetchFull(true);
                    return;
                }
                showError(statusToErrorKey(res.status), 3500);
            } catch {
                if (!alive()) return;
                // The move's fate is unknown: fall through to rollback + forced resync.
                showError("error_generic", 3500);
            } finally {
                actingRef.current = false;
                if (alive()) {
                    setPending(false);
                    const parked = parkedRef.current;
                    parkedRef.current = 0;
                    if (parked === Number.POSITIVE_INFINITY) void sync();
                    else if (parked > versionRef.current) void catchUp(parked);
                }
            }

            // Refused or lost: roll back unless a newer authoritative view already landed.
            if (predicted !== null) {
                setPayload((prev) =>
                    versionRef.current === snapshot.version ? snapshot : prev,
                );
            }
            await refetchFull(true).catch(() => {});
        },
        [
            gameId,
            table,
            userId,
            get,
            alive,
            show,
            adoptNow,
            refetchFull,
            catchUp,
            sync,
            showError,
        ],
    );

    return {
        payload,
        pending,
        setPending,
        actionError,
        showError,
        conn,
        onAction,
    };
}
