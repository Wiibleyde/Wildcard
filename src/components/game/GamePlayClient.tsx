"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { GameTable } from "@/components/game/GameTable";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import { THEMES } from "@/lib/card/themes";
import { freeTheme } from "@/lib/card/themes/free";
import type { GameAction } from "@/lib/engine/types";
import { getGameTable } from "@/lib/games";
import type { GameClientPayload } from "@/lib/models/game";
import { useGameChannel } from "@/lib/realtime/useGameChannel";

type ActionErrorKey = "error_illegal" | "error_conflict" | "error_generic";

/** Transient, localized notice for a refused action. */
function statusToErrorKey(status: number): ActionErrorKey {
    if (status === 422) return "error_illegal";
    if (status === 409) return "error_conflict";
    return "error_generic";
}

interface Props {
    initial: GameClientPayload;
    currentUserId: string;
    deckStyleId: string;
    boardStyleId: string;
}

/**
 * Owns the live game session on the client: holds the latest redacted payload,
 * refetches it whenever Realtime rings the doorbell, and forwards actions to
 * the server. Fully game-agnostic — the single `GameTable` renders whichever
 * game the catalog describes via its table config.
 */
export function GamePlayClient({
    initial,
    currentUserId,
    deckStyleId,
    boardStyleId,
}: Props) {
    const t = useTranslations("game");
    const [payload, setPayload] = useState<GameClientPayload>(initial);
    const [pending, setPending] = useState(false);
    const [actionError, setActionError] = useState<ActionErrorKey | null>(null);
    const errorTimer = useRef<number | null>(null);

    const refetch = useCallback(async () => {
        const res = await fetch(`/api/games/${initial.gameId}`, {
            cache: "no-store",
        });
        if (res.ok) {
            const next = (await res.json()) as GameClientPayload;
            // Concurrent refetches can resolve out of order — never let a
            // stale snapshot overwrite a newer one.
            setPayload((prev) => (next.version >= prev.version ? next : prev));
        }
    }, [initial.gameId]);

    useGameChannel(initial.gameId, refetch);

    const onAction = useCallback(
        async (action: GameAction) => {
            setPending(true);
            const res = await fetch(`/api/games/${initial.gameId}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version: payload.version, action }),
            });
            // A refused action (illegal move, version conflict) must not fail
            // silently — show a short, localized notice.
            if (!res.ok) {
                setActionError(statusToErrorKey(res.status));
                if (errorTimer.current !== null) {
                    clearTimeout(errorTimer.current);
                }
                errorTimer.current = window.setTimeout(
                    () => setActionError(null),
                    3500,
                );
            }
            // Whether it committed or hit a version conflict, resync now;
            // other clients are notified via Realtime.
            await refetch();
            setPending(false);
        },
        [initial.gameId, payload.version, refetch],
    );

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
            {actionError && (
                <div
                    className="mx-auto w-full max-w-3xl rounded-xl px-4 py-2 text-center text-sm font-bold xl:max-w-5xl 2xl:max-w-7xl"
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
                boardTheme={BOARD_THEMES[boardStyleId] ?? greenFeltTheme}
                pending={pending}
                onAction={onAction}
            />
        </div>
    );
}
