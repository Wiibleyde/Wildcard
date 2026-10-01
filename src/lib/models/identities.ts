import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Player identity — pseudo and avatar — owned by the portal of the wiibleyde.dev
 * infra (`portal.profiles`), not by Wildcard. The portal's RLS hides other
 * users' rows, so every read goes through the security-definer
 * `player_identities` RPC, which exposes exactly these two fields.
 */
export interface PlayerIdentity {
    /** Display name: the portal pseudo, or a stable fallback when unset. */
    readonly name: string;
    /** Object path in the portal's public avatars bucket, if any. */
    readonly avatarPath: string | null;
}

/** Public bucket the portal stores avatars in (`<uid>/<uuid>.<ext>`). */
export const PORTAL_AVATAR_BUCKET = "avatars";

/**
 * Name shown for a player who never picked a pseudo on the portal: "Joueur"
 * plus a short, stable id suffix, so two such players stay distinguishable.
 */
export function fallbackName(userId: string): string {
    return `Joueur ${userId.slice(0, 4)}`;
}

/**
 * Resolve identities for a set of user ids in one round trip, as a
 * `userId → identity` map. Every requested id is present: one without a portal
 * profile gets the fallback name.
 *
 * Accepts the RLS-scoped (signed-in) client or the service-role admin client;
 * the RPC is not granted to anon.
 */
export async function identitiesByIds(
    client: SupabaseClient<Database>,
    ids: readonly string[],
): Promise<Map<string, PlayerIdentity>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const { data } = await client.rpc("player_identities", {
        p_ids: unique,
    });
    const found = new Map((data ?? []).map((row) => [row.id, row]));
    return new Map(
        unique.map((id) => {
            const row = found.get(id);
            return [
                id,
                {
                    name: row?.pseudo ?? fallbackName(id),
                    avatarPath: row?.avatar_path ?? null,
                },
            ];
        }),
    );
}

/**
 * Display names only, as a `userId → name` map — what the lobby roster, the
 * deal step and the studio's creator column need.
 */
export async function usernamesByIds(
    client: SupabaseClient<Database>,
    ids: readonly string[],
): Promise<Map<string, string>> {
    const identities = await identitiesByIds(client, ids);
    return new Map([...identities].map(([id, { name }]) => [id, name]));
}

/** Identity of a single player (the signed-in viewer, typically). */
export async function identityOf(
    client: SupabaseClient<Database>,
    userId: string,
): Promise<PlayerIdentity> {
    const identities = await identitiesByIds(client, [userId]);
    return (
        identities.get(userId) ?? {
            name: fallbackName(userId),
            avatarPath: null,
        }
    );
}
