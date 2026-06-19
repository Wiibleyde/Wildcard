import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/** Per-account cap on pinned (never-expiring) replays. Mirrors the DB trigger. */
export const MAX_PERSISTENT_REPLAYS = 5;

export type PersistErrorCode = "not_participant" | "cap_reached" | "db_error";

async function countPins(admin: Admin, userId: string): Promise<number> {
    const { count } = await admin
        .from("persistent_replays")
        .select("game_id", { count: "exact", head: true })
        .eq("user_id", userId);
    return count ?? 0;
}

/**
 * Pin / unpin a finished game's replay for a user. Pinning exempts its move log
 * from the 15-day retention sweep (the replay never expires); unpinning lets the
 * next sweep collect it again.
 *
 * The per-account cap of {@link MAX_PERSISTENT_REPLAYS} is checked here for a
 * clean error and enforced again by a race-safe DB trigger (the real backstop).
 *
 * Security: a user may only pin a game they actually sat in — participation is
 * read from the authoritative engine state (`game_states.state.players`), never
 * trusted from the request. Must run with the service-role `admin` client.
 *
 * Note: pinning only protects future sweeps. A game whose moves were already
 * pruned cannot be recovered — pin it within the 15-day window to keep it.
 */
export async function setPersistent(
    admin: Admin,
    userId: string,
    gameId: string,
    persistent: boolean,
): Promise<
    { ok: true; count: number } | { ok: false; error: PersistErrorCode }
> {
    if (!persistent) {
        const { error } = await admin
            .from("persistent_replays")
            .delete()
            .eq("user_id", userId)
            .eq("game_id", gameId);
        if (error) return { ok: false, error: "db_error" };
        return { ok: true, count: await countPins(admin, userId) };
    }

    // Pinning: the game must be finished and the caller must have played in it.
    // Participation comes from the authoritative engine state; the `games!inner`
    // join restricts it to over games (only finished replays are pinnable, and
    // only the sweep — which skips pinned games — ever touches a finished log).
    const { data: seat } = await admin
        .from("game_states")
        .select("game_id, games!inner(is_over)")
        .eq("game_id", gameId)
        .eq("games.is_over", true)
        .contains("state", { players: [{ id: userId }] })
        .maybeSingle();
    if (!seat) return { ok: false, error: "not_participant" };

    // Already pinned → no-op. Returning early keeps re-pinning idempotent and
    // avoids re-tripping the BEFORE INSERT cap trigger when the account already
    // sits at the cap (this game is part of that count).
    const { data: existing } = await admin
        .from("persistent_replays")
        .select("game_id")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .maybeSingle();
    if (existing) return { ok: true, count: await countPins(admin, userId) };

    // Pre-check for a clean 409 before hitting the trigger.
    if ((await countPins(admin, userId)) >= MAX_PERSISTENT_REPLAYS) {
        return { ok: false, error: "cap_reached" };
    }

    const { error } = await admin
        .from("persistent_replays")
        .upsert({ user_id: userId, game_id: gameId });
    if (error) {
        // The cap trigger raises check_violation if a parallel pin beat us here.
        return {
            ok: false,
            error: error.code === "23514" ? "cap_reached" : "db_error",
        };
    }
    return { ok: true, count: await countPins(admin, userId) };
}
