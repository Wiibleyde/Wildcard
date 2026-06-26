"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { levelForXp } from "@/lib/xp/xp";

export interface GameOverXpState {
    /** True once we know the post-award total — gate the animation on this. */
    readonly ready: boolean;
    readonly gained: number;
    readonly before: number;
    readonly after: number;
    readonly levelBefore: number;
    readonly levelAfter: number;
    readonly leveledUp: boolean;
}

/**
 * Resolve the viewer's XP just after a game ends.
 *
 * `gained` is computed by the caller from the outcome (deterministic — same
 * constants the server uses), so we only need the authoritative *total* to
 * derive `before`/`after` and any level-up. We learn it two ways and keep the
 * larger (Math.max), which always lands on the post-award value:
 *
 * - an immediate fetch (the award is awaited in the server finish path, so it
 *   is almost always committed before this mounts), plus a delayed re-fetch as
 *   a backstop for the rare case the commit lands a hair later;
 * - a Realtime subscription on the player's `player_xp` row, which fires the
 *   instant the award commits and corrects a fetch that raced ahead of it.
 */
export function useGameOverXp(userId: string, gained: number): GameOverXpState {
    const [after, setAfter] = useState<number | null>(null);

    useEffect(() => {
        const supabase = createClient();
        let active = true;
        const bump = (xp: number) =>
            setAfter((cur) => (cur === null ? xp : Math.max(cur, xp)));

        const fetchXp = async () => {
            const { data } = await supabase
                .from("player_xp")
                .select("xp")
                .eq("user_id", userId)
                .single();
            if (active && data) bump(data.xp);
        };

        const channel = supabase
            .channel(`xp-gameover:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "player_xp",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const xp = (payload.new as { xp?: number }).xp;
                    if (active && typeof xp === "number") bump(xp);
                },
            )
            .subscribe();

        void fetchXp();
        // Backstop: catch an award that committed in the gap between subscribe
        // and the first fetch (so its Realtime event was missed).
        const retry = setTimeout(() => void fetchXp(), 700);

        return () => {
            active = false;
            clearTimeout(retry);
            void supabase.removeChannel(channel);
        };
    }, [userId]);

    if (after === null) {
        return {
            ready: false,
            gained,
            before: 0,
            after: 0,
            levelBefore: 1,
            levelAfter: 1,
            leveledUp: false,
        };
    }

    const before = Math.max(0, after - gained);
    const levelBefore = levelForXp(before);
    const levelAfter = levelForXp(after);
    return {
        ready: true,
        gained,
        before,
        after,
        levelBefore,
        levelAfter,
        leveledUp: levelAfter > levelBefore,
    };
}
