"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { xpTopic } from "@/lib/realtime/topics";
import { useAuthedChannel } from "@/lib/realtime/useAuthedChannel";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseSchema } from "@/lib/supabase/env";
import { levelForXp } from "@/lib/xp/xp";

export interface GameOverXpState {
    readonly ready: boolean;
    readonly gained: number;
    readonly before: number;
    readonly after: number;
    readonly levelBefore: number;
    readonly levelAfter: number;
    readonly leveledUp: boolean;
}

/** A one-shot screen: no status banner, so channel status is ignored. */
const ignoreStatus = (): void => {};

/**
 * `gained` is the server-settled award; only the post-award total is read
 * here, keeping the max of a fetch, a delayed re-fetch and the Realtime
 * UPDATE so a read that raced ahead of the award commit self-corrects.
 */
export function useGameOverXp(userId: string, gained: number): GameOverXpState {
    const [after, setAfter] = useState<number | null>(null);
    const bump = useCallback(
        (xp: number) =>
            setAfter((cur) => (cur === null ? xp : Math.max(cur, xp))),
        [],
    );

    const build = useCallback(
        (channel: RealtimeChannel) =>
            channel.on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: getSupabaseSchema(),
                    table: "player_xp",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const xp = (payload.new as { xp?: number }).xp;
                    if (typeof xp === "number") bump(xp);
                },
            ),
        [userId, bump],
    );
    useAuthedChannel(xpTopic(userId), build, ignoreStatus);

    useEffect(() => {
        const supabase = createClient();
        let active = true;
        const fetchXp = async () => {
            const { data } = await supabase
                .from("player_xp")
                .select("xp")
                .eq("user_id", userId)
                .single();
            if (active && data) bump(data.xp);
        };
        void fetchXp();
        const retry = setTimeout(() => void fetchXp(), 700);
        return () => {
            active = false;
            clearTimeout(retry);
        };
    }, [userId, bump]);

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
