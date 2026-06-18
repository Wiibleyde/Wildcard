import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Resolve display names for a set of user ids in one query, as a
 * `userId → username` map (ids with no profile are simply absent). The lobby
 * server page, the live lobby roster, and the deal step all built this exact
 * `select("id, username").in(...)` + `new Map(...)` by hand — this is that, once.
 *
 * Accepts any {@link SupabaseClient} (the RLS-scoped browser/server client or
 * the service-role admin client), since `profiles` is world-readable to
 * authenticated users.
 */
export async function usernamesByIds(
    client: SupabaseClient<Database>,
    ids: readonly string[],
): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data } = await client
        .from("profiles")
        .select("id, username")
        .in("id", ids as string[]);
    return new Map((data ?? []).map((p) => [p.id, p.username]));
}
