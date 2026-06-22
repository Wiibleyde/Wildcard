"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
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

type ActionErrorKey = "error_illegal" | "error_conflict" | "error_generic";

function statusToErrorKey(status: number): ActionErrorKey {
    if (status === 422) return "error_illegal";
    if (status === 409) return "error_conflict";
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

    const refetch = useCallback(async () => {
        const res = await fetch(`/api/games/${initial.gameId}`, {
            cache: "no-store",
        });
        if (res.ok) {
            const next = (await res.json()) as GameClientPayload;
            // Adopt only a strictly newer version: equal/stale refetches keep the
            // same object so React skips re-render — else the fan churns mid-selection.
            setPayload((prev) => (next.version > prev.version ? next : prev));
        }
    }, [initial.gameId]);

    // Poll slow on your turn (nobody else can act), fast otherwise to catch moves —
    // postgres_changes is unreliable on self-hosted stacks, so the poll is the dependable path.
    const myTurn =
        payload.currentPlayerId !== null &&
        payload.currentPlayerId === currentUserId;
    const conn = useGameChannel(initial.gameId, refetch, myTurn ? 4000 : 800);

    const onAction = useCallback(
        async (action: GameAction) => {
            setPending(true);
            const res = await fetch(`/api/games/${initial.gameId}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version: payload.version, action }),
            });
            if (!res.ok) {
                showError(statusToErrorKey(res.status), 3500);
            }
            // Resync whether it committed or hit a version conflict.
            await refetch();
            setPending(false);
        },
        [initial.gameId, payload.version, refetch, showError],
    );

    const onIllegal = useCallback(
        () => showError("error_illegal", 3500),
        [showError],
    );

    const leave = useCallback(async () => {
        if (!payload.isOver) {
            const ok = await confirm({
                title: t("leave"),
                message: t("leave_confirm"),
                confirmLabel: t("leave"),
                variant: "red",
            });
            if (!ok) return;
        }
        router.push("/lobby");
    }, [confirm, payload.isOver, router, t]);

    const boardTheme = BOARD_THEMES[boardStyleId] ?? greenFeltTheme;

    const table = getGameTable(payload.moduleId);
    if (!table) {
        return (
            <div className="p-8 text-center" style={{ color: "#9a8870" }}>
                {payload.moduleId}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <ReconnectingBanner status={conn} />
            <div className="mx-auto flex w-full max-w-3xl justify-end lg:max-w-none">
                <GameButton variant="ghost" size="sm" onClick={leave}>
                    {t("leave")}
                </GameButton>
            </div>
            {actionError && (
                <div
                    className="mx-auto w-full max-w-3xl rounded-xl px-4 py-2 text-center text-sm font-bold lg:max-w-none"
                    style={{
                        background: "rgba(224,64,64,0.12)",
                        color: "#e04040",
                        border: "1px solid rgba(224,64,64,0.4)",
                    }}
                    role="alert"
                >
                    {t(actionError)}
                </div>
            )}
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
                        boardTheme={boardTheme}
                        isOver={payload.isOver}
                    />
                }
            />
        </div>
    );
}
