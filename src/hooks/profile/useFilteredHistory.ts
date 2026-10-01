"use client";

import { useMemo, useState } from "react";
import type { MatchHistoryEntry } from "@/lib/models/history";

/**
 * Local-midnight epoch for an `<input type="date">` value ("YYYY-MM-DD"),
 * shifted by `dayOffset` days. `new Date("YYYY-MM-DD")` would parse as UTC
 * midnight, moving the bounds by the viewer's UTC offset; the Date
 * constructor's local fields also stay correct across DST changes.
 */
function localDayStart(value: string, dayOffset = 0): number | null {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d + dayOffset).getTime();
}

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
        const fromMs = from ? localDayStart(from) : null;
        // `to` is a day → include the whole day: stop at the next local midnight.
        const toMs = to ? localDayStart(to, 1) : null;
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
