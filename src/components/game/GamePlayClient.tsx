"use client";

import { useCallback, useState } from "react";
import { BatailleTable } from "@/components/game/BatailleTable";
import { PresidentTable } from "@/components/game/PresidentTable";
import { BOARD_THEMES } from "@/lib/board/themes";
import { greenFeltTheme } from "@/lib/board/themes/green_felt";
import { THEMES } from "@/lib/card/themes";
import { freeTheme } from "@/lib/card/themes/free";
import type { GameAction } from "@/lib/engine/types";
import type { BatailleView } from "@/lib/games/bataille/bataille";
import type { PresidentView } from "@/lib/games/president/president";
import type { GameClientPayload } from "@/lib/models/game";
import { useGameChannel } from "@/lib/realtime/useGameChannel";

interface Props {
    initial: GameClientPayload;
    currentUserId: string;
    deckStyleId: string;
    boardStyleId: string;
}

/**
 * Owns the live game session on the client: holds the latest redacted payload,
 * refetches it whenever Realtime rings the doorbell, and forwards actions to
 * the server. It is game-agnostic — it picks the right table by `moduleId` and
 * hands it the narrowed `view`.
 */
export function GamePlayClient({
    initial,
    currentUserId,
    deckStyleId,
    boardStyleId,
}: Props) {
    const [payload, setPayload] = useState<GameClientPayload>(initial);
    const [pending, setPending] = useState(false);

    const refetch = useCallback(async () => {
        const res = await fetch(`/api/games/${initial.gameId}`, {
            cache: "no-store",
        });
        if (res.ok) {
            setPayload((await res.json()) as GameClientPayload);
        }
    }, [initial.gameId]);

    useGameChannel(initial.gameId, refetch);

    const onAction = useCallback(
        async (action: GameAction) => {
            setPending(true);
            await fetch(`/api/games/${initial.gameId}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version: payload.version, action }),
            });
            // Whether it committed or hit a version conflict, resync now;
            // other clients are notified via Realtime.
            await refetch();
            setPending(false);
        },
        [initial.gameId, payload.version, refetch],
    );

    const deckTheme = THEMES[deckStyleId] ?? freeTheme;
    const boardTheme = BOARD_THEMES[boardStyleId] ?? greenFeltTheme;

    const shared = {
        payload,
        currentUserId,
        deckTheme,
        boardTheme,
        pending,
        onAction,
    } as const;

    if (payload.moduleId === "bataille") {
        return (
            <BatailleTable {...shared} view={payload.view as BatailleView} />
        );
    }
    if (payload.moduleId === "president") {
        return (
            <PresidentTable {...shared} view={payload.view as PresidentView} />
        );
    }

    return (
        <div className="p-8 text-center" style={{ color: "#9a8870" }}>
            {payload.moduleId}
        </div>
    );
}
