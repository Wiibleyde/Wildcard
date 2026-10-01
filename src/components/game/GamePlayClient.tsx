"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { GameChat } from "@/components/game/GameChat";
import { GameTable } from "@/components/game/GameTable";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { useTransientNotice } from "@/hooks/game/useTransientNotice";
import { useRouter } from "@/i18n/navigation";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import { THEMES } from "@/lib/card/themes";
import { freeTheme } from "@/lib/card/themes/free";
import type { GameAction } from "@/lib/engine/types";
import { getGameTable } from "@/lib/games";
import type { GameClientPayload } from "@/lib/models/game";
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
    // Latest version we hold, mirrored outside React so the cheap probe can gate
    // the full fetch without making the poll callback depend on (and churn with)
    // `payload`.
    const versionRef = useRef(initial.version);
    // Latest payload, mirrored so the action handler can snapshot the pre-move
    // state (for the optimistic rollback) without depending on `payload` and
    // re-creating the table's memoised callbacks on every move.
    const payloadRef = useRef(payload);
    payloadRef.current = payload;

    // Adopt a payload only if it is strictly newer than what we hold: equal/
    // stale ones keep the same object so React skips re-render — else the fan
    // churns mid-selection. Shared by the full GET and the action POST response.
    // `force` bypasses the version gate: after a failed action the board may
    // show a prediction at an unchanged version, and only the server's view
    // can clear it.
    const adopt = useCallback((next: GameClientPayload, force = false) => {
        setPayload((prev) => {
            if (!force && next.version <= prev.version) return prev;
            versionRef.current = next.version;
            return next;
        });
    }, []);

    // Pull the full redacted payload (poll/doorbell reconcile path).
    const refetchFull = useCallback(
        async (force = false) => {
            const res = await fetch(`/api/games/${initial.gameId}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                // Lost access (404) is worth saying; other failures stay
                // silent here — the next poll retries.
                if (res.status === 404) showError("error_no_access", 5000);
                return;
            }
            adopt((await res.json()) as GameClientPayload, force);
        },
        [initial.gameId, adopt, showError],
    );

    // Poll/doorbell entry point: hit the few-byte version probe and only pull
    // the heavy payload when the server has actually advanced. Steady-state
    // polling is then off the secret state, the log and the view projection, and
    // the board never re-renders on an unchanged tick.
    const sync = useCallback(async () => {
        const res = await fetch(`/api/games/${initial.gameId}/version`, {
            cache: "no-store",
        });
        if (!res.ok) return;
        const info = (await res.json()) as { version: number };
        if (info.version <= versionRef.current) return;
        await refetchFull();
    }, [initial.gameId, refetchFull]);

    // Poll slow on your turn (nobody else can act), fast otherwise to catch moves —
    // postgres_changes is unreliable on self-hosted stacks, so the poll is the dependable path.
    const myTurn =
        payload.currentPlayerId !== null &&
        payload.currentPlayerId === currentUserId;
    const conn = useGameChannel(initial.gameId, sync, myTurn ? 4000 : 800);

    // Resolve the game's table config once — the module never changes mid-game.
    const table = getGameTable(initial.moduleId);

    const onAction = useCallback(
        async (action: GameAction) => {
            const snapshot = payloadRef.current;
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
                setPayload({
                    ...snapshot,
                    view: predicted,
                    legalActions: [],
                    currentPlayerId: null,
                });
            } else {
                setPending(true);
            }

            try {
                const res = await fetch(
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
                    if (data.payload) adopt(data.payload);
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
        [initial.gameId, table, currentUserId, adopt, refetchFull, showError],
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
                    const res = await fetch(
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
