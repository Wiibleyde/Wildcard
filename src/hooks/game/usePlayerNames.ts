"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
    findPlayerName,
    localizePlayers,
    type NameLabels,
} from "@/lib/games/table/playerName";
import type { GamePlayer } from "@/lib/models/game";
import { nameTag } from "@/lib/models/identities";

export interface PlayerNames {
    readonly players: readonly GamePlayer[];
    readonly nameOf: (userId: string | null) => string;
}

export function usePlayerNames(
    players: readonly GamePlayer[],
    botIds: readonly string[],
): PlayerNames {
    const t = useTranslations("common");
    return useMemo(() => {
        const labels: NameLabels = {
            bot: (n) => t("computer", { n }),
            unknown: (tag) => t("player_fallback", { tag }),
        };
        const shown = localizePlayers(players, botIds, labels);
        return {
            players: shown,
            nameOf: (userId) =>
                findPlayerName(shown, userId) ??
                labels.unknown(userId ? nameTag(userId) : "?"),
        };
    }, [players, botIds, t]);
}
