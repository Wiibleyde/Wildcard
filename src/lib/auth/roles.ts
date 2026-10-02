import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Global role (user < moderator < admin), distinct from the per-lobby
 * player/spectator role. Service-role write only, so it cannot be self-granted.
 */
export type AppRole = "user" | "moderator" | "admin";

const RANK: Record<AppRole, number> = { user: 0, moderator: 1, admin: 2 };

export function isAppRole(value: unknown): value is AppRole {
    return typeof value === "string" && Object.hasOwn(RANK, value);
}

export function roleAtLeast(role: AppRole, min: AppRole): boolean {
    return RANK[role] >= RANK[min];
}

/** Fails closed: a missing, unknown or unreadable role is `user`. */
export async function getUserRole(
    supabase: SupabaseClient<Database>,
    userId: string,
): Promise<AppRole> {
    const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) console.error("[roles] read failed:", error.message);
    const role: unknown = data?.role;
    return isAppRole(role) ? role : "user";
}
