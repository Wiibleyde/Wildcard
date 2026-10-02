"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameChat } from "@/components/game/GameChat";
import { GameTable } from "@/components/game/GameTable";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { useTransientNotice } from "@/hooks/game/useTransientNotice";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import { THEMES } from "@/lib/card/themes";
import { freeTheme } from "@/lib/card/themes/free";
import type { GameAction } from "@/lib/engine/types";
import { getGameTable } from "@/lib/games";
import type {
    GameClientPayload,
    GameFrame,
    GameSyncPayload,
} from "@/lib/models/game";
import { useGameChannel } from "@/lib/realtime/useGameChannel";

type ActionErrorKey =
    | "error_illegal"
    | "error_conflict"
    | "error_generic"
    | "error_rate_limited"
    | "error_maintenance"
    | "error_payload_too_large"
    | "error_no_access"
    | "error_leave_failed";

function statusToErrorKey(status: number): ActionErrorKey {
    if (status === 422) return "error_illegal";
    if (status === 409) return "error_conflict";
    if (status === 429) return "error_rate_limited";
    if (status === 503) return "error_maintenance";
    if (status === 413) return "error_payload_too_large";
    if (status === 403 || status === 404) return "error_no_access";
    return "error_generic";
}

/**
 * Minimum time each move stays on screen before the next queued one replaces
 * it — just over the longest card landing (0.55s), and under the server's bot
 * pacing (900ms) so playback never falls behind a live game.
 */
const FRAME_MS = 650;

/**
 * An intermediate board for playback: the head's metadata with that move's
 * view. Never actionable (no legal moves) and never the end — only the head
 * carries those.
 */
function frameBoard(
    head: GameClientPayload,
    frame: GameFrame,
): GameClientPayload {
    return {
        ...head,
        version: frame.version,
        phase: frame.phase,
        currentPlayerId: frame.currentPlayerId,
        view: frame.view,
        legalActions: [],
        isOver: false,
        outcome: null,
        end: null,
        log: head.log.filter((entry) => entry.seq <= frame.version),
    };
}

interface Props {
    initial: GameClientPayload;
    currentUserId: string;
    /** Viewer's display name — passed to chat so spectators aren't shown as "?". */
    currentUserName: string;
    deckStyleId: string;
    boardStyleId: string;
}

export function GamePlayClient({
    initial,
    currentUserId,
    currentUserName,
    deckStyleId,
    boardStyleId,
}: Props) {
    const t = useTranslations("game");
    const router = useRouter();
    const confirm = useConfirm();
    const [payload, setPayload] = useState<GameClientPayload>(initial);
    const [pending, setPending] = useState(false);
    const [actionError, showError] = useTransientNotice<ActionErrorKey>();
    // Highest version we hold — on screen OR waiting in the playback queue.
    // Mirrored outside React so the doorbell/poll can gate fetches without
    // making their callbacks depend on (and churn with) `payload`.
    const versionRef = useRef(initial.version);
    // Latest payload, mirrored so the action handler can snapshot the pre-move
    // state (for the optimistic rollback) without depending on `payload` and
    // re-creating the table's memoised callbacks on every move.
    const payloadRef = useRef(payload);
    payloadRef.current = payload;

    // ── Move playback ────────────────────────────────────────────────────
    // Each move the server commits is shown as its own board for at least
    // FRAME_MS, so a burst (bots chaining, a fast opponent, a late ring)
    // plays back one card at a time instead of two landing in one render.
    const queueRef = useRef<GameClientPayload[]>([]);
    const shownAtRef = useRef(0);
    const timerRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        },
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
                const next = queueRef.current.shift();
                if (next) show(next);
                pumpQueue();
            }, wait);
        },
        [show],
    );

    // Queue boards strictly newer than everything we hold, in order.
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

    // Show a board right now, dropping any pending playback. For the actor's
    // own commit (already predicted on screen) and forced resyncs. Equal/stale
    // payloads are ignored unless `force`: after a failed action the board may
    // show a prediction at an unchanged version, and only the server's view
    // can clear it.
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

    // Pull the full redacted payload and show it at once (resync path).
    const refetchFull = useCallback(
        async (force = false) => {
            const res = await apiFetch(`/api/games/${initial.gameId}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                // Lost access (404) is worth saying; other failures stay
                // silent here — the next poll retries.
                if (res.status === 404) showError("error_no_access", 5000);
                return;
            }
            adoptNow((await res.json()) as GameClientPayload, force);
        },
        [initial.gameId, adoptNow, showError],
    );

    // Catch-up read: the head plus every move since the version we hold,
    // queued for playback. Each caller states the version it knows exists;
    // rings arriving while a read is in flight only raise that target, and a
    // follow-up read runs only if the first one did not already reach it — so
    // the double ring (Broadcast + CDC) of one move costs a single request.
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
                    const res = await apiFetch(
                        `/api/games/${initial.gameId}?since=${before}`,
                        { cache: "no-store" },
                    );
                    if (!res.ok) {
                        if (res.status === 404) {
                            showError("error_no_access", 5000);
                        }
                        return;
                    }
                    const { frames, ...head } =
                        (await res.json()) as GameSyncPayload;
                    enqueue([
                        ...(frames ?? []).map((f) => frameBoard(head, f)),
                        head,
                    ]);
                    // A forged/stale ring announcing a version the server
                    // doesn't have must not loop: no progress, stop.
                    if (versionRef.current === before) return;
                }
            } catch {
                // Network blip — the next ring or heartbeat retries.
            } finally {
                inFlightRef.current = false;
            }
        },
        [initial.gameId, enqueue, showError],
    );

    // Doorbell/poll entry point. A ring carries the new version, so a stale
    // or duplicate one (Broadcast + CDC both fire) costs no request at all.
    // A bare resync (poll tick, reconnect, refocus) asks the few-byte version
    // probe first and pulls the heavy payload only when the game has moved.
    // While our own action is in flight its POST response is about to bring
    // the new board — rings (including our own move's) are parked here and
    // replayed after, instead of racing the response with a duplicate read.
    // A bare resync parks as +∞: replayed as a probe, its target is unknown.
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
                const res = await apiFetch(
                    `/api/games/${initial.gameId}/version`,
                    { cache: "no-store" },
                );
                if (!res.ok) return;
                const info = (await res.json()) as { version: number };
                if (info.version > versionRef.current) {
                    await catchUp(info.version);
                }
            } catch {
                // Offline — the reconnect resync covers it.
            }
        },
        [initial.gameId, catchUp],
    );

    // Broadcast-fed: while connected the poll is a slow heartbeat (set in the
    // hook). Disconnected, poll slow on your turn (nobody else can act) and
    // fast otherwise to keep catching moves.
    const myTurn =
        payload.currentPlayerId !== null &&
        payload.currentPlayerId === currentUserId;
    const conn = useGameChannel(initial.gameId, sync, myTurn ? 4000 : 1000);

    // Resolve the game's table config once — the module never changes mid-game.
    const table = getGameTable(initial.moduleId);

    const onAction = useCallback(
        async (action: GameAction) => {
            const snapshot = payloadRef.current;
            actingRef.current = true;
            parkedRef.current = 0;
            // UI-first: apply the move locally the instant the player acts, so
            // the board reacts without waiting on the round-trip. `predict`
            // returns `null` for moves it can't safely guess (hidden reveals),
            // and we fall back to the old wait-for-server spinner.
            const predicted = table?.predict
                ? (table.predict(snapshot.view, action, currentUserId) ?? null)
                : null;

            if (predicted !== null) {
                // Freeze input until the server reconciles: blank the turn and
                // drop the legal actions so the board offers nothing to click.
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
                const res = await apiFetch(
                    `/api/games/${initial.gameId}/actions`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            version: snapshot.version,
                            action,
                        }),
                    },
                );
                if (res.ok) {
                    // The commit returns the fresh authoritative payload —
                    // adopt it directly (overwrites the prediction), no GET.
                    const data = (await res.json().catch(() => ({}))) as {
                        payload?: GameClientPayload;
                    };
                    if (data.payload) adoptNow(data.payload);
                    else await refetchFull(true);
                    return;
                }
                showError(statusToErrorKey(res.status), 3500);
            } catch {
                // Network drop / unreadable response: the move's fate is
                // unknown, so fall through to the rollback + forced resync.
                showError("error_generic", 3500);
            } finally {
                setPending(false);
                actingRef.current = false;
                // Our own move's ring is now stale (the response carried it);
                // anything newer parked meanwhile — a bot already answered —
                // is caught up now.
                const parked = parkedRef.current;
                parkedRef.current = 0;
                if (parked === Number.POSITIVE_INFINITY) void sync();
                else if (parked > versionRef.current) void catchUp(parked);
            }

            // The move was refused or lost — roll the board back to the
            // pre-move state, unless a newer authoritative view already landed
            // (it wins). Without this a prediction at an unchanged version
            // would freeze the board: the poll only refetches on a bump.
            if (predicted !== null) {
                setPayload((prev) =>
                    versionRef.current === snapshot.version ? snapshot : prev,
                );
            }
            // Pull the authoritative state, adopting it even at an equal
            // version so any leftover prediction is cleared.
            await refetchFull(true).catch(() => {});
        },
        [
            initial.gameId,
            table,
            currentUserId,
            show,
            adoptNow,
            refetchFull,
            catchUp,
            sync,
            showError,
        ],
    );

    const onIllegal = useCallback(
        () => showError("error_illegal", 3500),
        [showError],
    );

    // A seated player leaving a live game forfeits it (server-side, in
    // `leaveRoom` → `forfeitGame`): the game ends at once, the leaver loses and
    // everyone else wins. Spectators — and anyone once the game is over — just
    // navigate away.
    const isSeated = payload.viewerId !== null;
    const leave = useCallback(async () => {
        if (!payload.isOver && isSeated) {
            const ok = await confirm({
                title: t("leave"),
                message: t("leave_confirm"),
                confirmLabel: t("leave"),
                variant: "red",
            });
            if (!ok) return;
            if (payload.roomCode) {
                setPending(true);
                try {
                    const res = await apiFetch(
                        `/api/rooms/${encodeURIComponent(payload.roomCode)}/leave`,
                        { method: "POST" },
                    );
                    if (!res.ok) {
                        showError(
                            res.status === 429 || res.status === 503
                                ? statusToErrorKey(res.status)
                                : "error_leave_failed",
                            3500,
                        );
                        return;
                    }
                } catch {
                    showError("error_leave_failed", 3500);
                    return;
                } finally {
                    setPending(false);
                }
            }
        }
        router.push("/lobby");
    }, [
        confirm,
        isSeated,
        payload.isOver,
        payload.roomCode,
        router,
        showError,
        t,
    ]);

    const boardTheme = BOARD_THEMES[boardStyleId] ?? greenFeltTheme;

    if (!table) {
        return (
            <div
                role="alert"
                className="mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center lg:max-w-3xl"
                style={{ color: "var(--muted)" }}
            >
                <p className="font-bold">{t("unknown_game")}</p>
                <GameButton
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/lobby")}
                >
                    {t("back_to_lobby")}
                </GameButton>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Leave row doubles as the anchor for transient banners: they
                float over the top of the table instead of pushing it down, so
                the one-screen lg layout never grows a page scroll. */}
            <div className="relative mx-auto flex w-full max-w-3xl justify-end lg:max-w-none">
                <GameButton variant="ghost" size="sm" onClick={leave}>
                    {t("leave")}
                </GameButton>
                <div className="pointer-events-none absolute inset-x-0 top-full z-40 mt-1 flex flex-col items-center gap-2 px-2">
                    <ReconnectingBanner status={conn} />
                    {actionError && (
                        <div
                            className="w-full max-w-xl rounded-xl px-4 py-2 text-center text-sm font-bold shadow-lg"
                            style={{
                                background: "#fbe4e4",
                                color: "#b42323",
                                border: "2px solid #e04040",
                            }}
                            role="alert"
                        >
                            {t(actionError)}
                        </div>
                    )}
                </div>
            </div>
            <GameTable
                table={table}
                view={payload.view}
                payload={payload}
                currentUserId={currentUserId}
                deckTheme={THEMES[deckStyleId] ?? freeTheme}
                boardTheme={boardTheme}
                pending={pending}
                onAction={onAction}
                onIllegal={onIllegal}
                chat={
                    <GameChat
                        gameId={initial.gameId}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        players={payload.players}
                        isOver={payload.isOver}
                    />
                }
            />
        </div>
    );
}
