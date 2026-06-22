"use client";

import { useMemo, useState } from "react";
import type { MatchHistoryEntry } from "@/lib/models/history";

const DAY_MS = 86_400_000;

export function useFilteredHistory(entries: readonly MatchHistoryEntry[]) {
    const [game, setGame] = useState("all");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const games = useMemo(() => {
        const seen = new Map<string, string>();
        for (const e of entries) seen.set(e.moduleId, e.moduleName);
        return [...seen].map(([id, name]) => ({ id, name }));
    }, [entries]);

    const filtered = useMemo(() => {
        const fromMs = from ? new Date(from).getTime() : null;
        // `to` is a day → include the whole day by pushing to its end.
        const toMs = to ? new Date(to).getTime() + DAY_MS : null;
        return entries.filter((e) => {
            if (game !== "all" && e.moduleId !== game) return false;
            const at = new Date(e.playedAt).getTime();
            if (fromMs !== null && at < fromMs) return false;
            if (toMs !== null && at >= toMs) return false;
            return true;
        });
    }, [entries, game, from, to]);

    const hasFilters = game !== "all" || from !== "" || to !== "";

    function reset() {
        setGame("all");
        setFrom("");
        setTo("");
    }

    return {
        game,
        setGame,
        from,
        setFrom,
        to,
        setTo,
        games,
        filtered,
        hasFilters,
        reset,
    };
}
