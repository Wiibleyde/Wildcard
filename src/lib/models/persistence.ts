import type { AdminClient } from "@/lib/supabase/admin";
import { CHECK_VIOLATION } from "@/lib/supabase/pgErrors";

/** Mirrors the DB trigger, which is the race-safe backstop. */
export const MAX_PERSISTENT_REPLAYS = 5;

export type PersistErrorCode = "not_participant" | "cap_reached" | "db_error";

export const PERSIST_ERROR_STATUS: Record<PersistErrorCode, number> = {
    not_participant: 403,
    cap_reached: 409,
    db_error: 500,
};

type PersistResult =
    | { ok: true; count: number }
    | { ok: false; error: PersistErrorCode; message?: string };

async function pinCount(
    admin: AdminClient,
    userId: string,
): Promise<PersistResult> {
    const { count, error } = await admin
        .from("persistent_replays")
        .select("game_id", { count: "exact", head: true })
        .eq("user_id", userId);
    if (error) return { ok: false, error: "db_error", message: error.message };
    return { ok: true, count: count ?? 0 };
}

/**
 * Pin / unpin a finished game's replay (exempt from the 15-day sweep). Only a
 * player who sat in the game may pin it, read from the engine state, never the
 * request. Pinning cannot bring back an already pruned log.
 */
export async function setPersistent(
    admin: AdminClient,
    userId: string,
    gameId: string,
    persistent: boolean,
): Promise<PersistResult> {
    if (!persistent) {
        const { error } = await admin
            .from("persistent_replays")
            .delete()
            .eq("user_id", userId)
            .eq("game_id", gameId);
        if (error) {
            return { ok: false, error: "db_error", message: error.message };
        }
        return pinCount(admin, userId);
    }

    const { data: seat, error: seatError } = await admin
        .from("game_states")
        .select("game_id, games!inner(is_over)")
        .eq("game_id", gameId)
        .eq("games.is_over", true)
        .contains("state", { players: [{ id: userId }] })
        .maybeSingle();
    if (seatError) {
        return { ok: false, error: "db_error", message: seatError.message };
    }
    if (!seat) return { ok: false, error: "not_participant" };

    // Re-pinning is a no-op, so an account at the cap does not trip the trigger.
    const { data: existing, error: existingError } = await admin
        .from("persistent_replays")
        .select("game_id")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .maybeSingle();
    if (existingError) {
        return { ok: false, error: "db_error", message: existingError.message };
    }
    if (existing) return pinCount(admin, userId);

    const before = await pinCount(admin, userId);
    if (!before.ok) return before;
    if (before.count >= MAX_PERSISTENT_REPLAYS) {
        return { ok: false, error: "cap_reached" };
    }

    const { error } = await admin
        .from("persistent_replays")
        .upsert({ user_id: userId, game_id: gameId });
    if (error) {
        // A parallel pin beat us to the cap trigger.
        return error.code === CHECK_VIOLATION
            ? { ok: false, error: "cap_reached" }
            : { ok: false, error: "db_error", message: error.message };
    }
    return pinCount(admin, userId);
}
