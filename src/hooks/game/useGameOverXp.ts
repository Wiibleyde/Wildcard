"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
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

/**
 * `gained` is the server-settled award; only the post-award total is read
 * here, keeping the max of a fetch, a delayed re-fetch and the Realtime
 * UPDATE so a read that raced ahead of the award commit self-corrects.
 */
export function useGameOverXp(userId: string, gained: number): GameOverXpState {
    const [after, setAfter] = useState<number | null>(null);

    useEffect(() => {
        const supabase = createClient();
        let active = true;
        let channel: RealtimeChannel | null = null;
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

        const subscribe = async () => {
            // Without the user's token the socket joins as `anon` and RLS drops every change.
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active) return;
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
            channel = supabase
                .channel(`xp-gameover:${userId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: getSupabaseSchema(),
                        table: "player_xp",
                        filter: `user_id=eq.${userId}`,
                    },
                    (payload) => {
                        const xp = (payload.new as { xp?: number }).xp;
                        if (active && typeof xp === "number") bump(xp);
                    },
                )
                .subscribe();
        };

        void subscribe();
        void fetchXp();
        const retry = setTimeout(() => void fetchXp(), 700);

        return () => {
            active = false;
            clearTimeout(retry);
            if (channel) void supabase.removeChannel(channel);
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
