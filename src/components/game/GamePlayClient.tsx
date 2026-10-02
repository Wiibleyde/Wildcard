"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { GameChat } from "@/components/game/GameChat";
import { GameTable } from "@/components/game/GameTable";
import { ReconnectingBanner } from "@/components/realtime/ReconnectingBanner";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { statusToErrorKey } from "@/hooks/game/gamePayload";
import { useGameSync } from "@/hooks/game/useGameSync";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";
import { getBoardTheme } from "@/lib/board/themes";
import { getCardTheme } from "@/lib/card/themes";
import { getGameTable } from "@/lib/games";
import type { GameClientPayload } from "@/lib/models/game";

interface Props {
    initial: GameClientPayload;
    currentUserId: string;
    /** Stamped on chat messages so spectators aren't shown as unknown. */
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
    const table = getGameTable(initial.moduleId);
    const {
        payload,
        pending,
        setPending,
        actionError,
        showError,
        conn,
        onAction,
    } = useGameSync(initial.gameId, initial, table, currentUserId);

    const onIllegal = useCallback(
        () => showError("error_illegal", 3500),
        [showError],
    );

    // Forfeiting goes through the room's leave endpoint; a game without a room
    // has no way to forfeit, so leaving it must not claim to.
    const canForfeit =
        !payload.isOver &&
        payload.viewerId !== null &&
        payload.roomCode !== null;
    const leave = useCallback(async () => {
        if (canForfeit && payload.roomCode) {
            const ok = await confirm({
                title: t("leave"),
                message: t("leave_confirm"),
                confirmLabel: t("leave"),
                variant: "red",
            });
            if (!ok) return;
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
        router.push("/lobby");
    }, [
        canForfeit,
        confirm,
        payload.roomCode,
        router,
        setPending,
        showError,
        t,
    ]);

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
            {/* Banners float over the table so the one-screen lg layout never scrolls. */}
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
                payload={payload}
                currentUserId={currentUserId}
                deckTheme={getCardTheme(deckStyleId)}
                boardTheme={getBoardTheme(boardStyleId)}
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
