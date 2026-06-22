"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { MatchHistoryEntry } from "@/lib/models/history";
import { MAX_PERSISTENT_REPLAYS } from "@/lib/models/persistence";

// Pinned games survive the 15-day move-retention sweep; capped per account.
export function useGamePinning(entries: readonly MatchHistoryEntry[]) {
    const t = useTranslations("history");
    const [pinned, setPinned] = useState<Set<string>>(
        () => new Set(entries.filter((e) => e.persistent).map((e) => e.gameId)),
    );
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isPinned = (id: string) => pinned.has(id);

    async function togglePin(gameId: string) {
        if (busy) return;
        const next = !pinned.has(gameId);
        if (next && pinned.size >= MAX_PERSISTENT_REPLAYS) {
            setError(t("cap_reached", { max: MAX_PERSISTENT_REPLAYS }));
            return;
        }
        setBusy(gameId);
        setError(null);
        setPinned((prev) => {
            const copy = new Set(prev);
            if (next) copy.add(gameId);
            else copy.delete(gameId);
            return copy;
        });
        try {
            const res = await fetch(`/api/games/${gameId}/persist`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ persistent: next }),
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: string;
                };
                throw new Error(body.error ?? "pin_error");
            }
        } catch (e) {
            setPinned((prev) => {
                const copy = new Set(prev);
                if (next) copy.delete(gameId);
                else copy.add(gameId);
                return copy;
            });
            const code = e instanceof Error ? e.message : "pin_error";
            setError(
                code === "cap_reached"
                    ? t("cap_reached", { max: MAX_PERSISTENT_REPLAYS })
                    : t("pin_error"),
            );
        } finally {
            setBusy(null);
        }
    }

    return { pinnedCount: pinned.size, isPinned, busy, error, togglePin };
}
