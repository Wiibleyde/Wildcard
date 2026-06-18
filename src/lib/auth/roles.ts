import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Global account role — distinct from the per-lobby `room_players.role`
 * (player/spectator). The three values form a strict hierarchy:
 *
 *   user  <  moderator  <  admin
 *
 * A moderator can watch live games (the moderator dashboard); an admin can do
 * everything a moderator can, plus toggle site maintenance. The role lives in
 * `user_roles` (service-role write only) so it cannot be self-granted.
 */
export type AppRole = "user" | "moderator" | "admin";

const RANK: Record<AppRole, number> = { user: 0, moderator: 1, admin: 2 };

/** True when `role` is at least as privileged as `min` in the hierarchy. */
export function roleAtLeast(role: AppRole, min: AppRole): boolean {
    return RANK[role] >= RANK[min];
}

/**
 * Read a user's global role. Defaults to `"user"` when no row exists (every
 * profile is backfilled with one, but a missing/denied read must never grant
 * privilege — fail closed).
 */
export async function getUserRole(
    supabase: SupabaseClient<Database>,
    userId: string,
): Promise<AppRole> {
    const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
    return (data?.role as AppRole | undefined) ?? "user";
}
