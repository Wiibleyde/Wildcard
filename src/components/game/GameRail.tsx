"use client";

import type { ReactNode } from "react";
import type { GameLogLine } from "@/hooks/game/logLines";
import { GameLog } from "./GameLog";

/** `logLines === null`: the game has no log feed. */
export function GameRail({
    logLines,
    chat,
}: {
    logLines: readonly GameLogLine[] | null;
    chat?: ReactNode;
}) {
    if (!logLines && !chat) return null;
    return (
        <div className="flex flex-col gap-3 lg:h-[70vh] lg:self-start">
            {logLines && <GameLog lines={logLines} />}
            {chat}
        </div>
    );
}
