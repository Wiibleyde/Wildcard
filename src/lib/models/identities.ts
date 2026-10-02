import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";

/**
 * Pseudo and avatar are owned by the portal (`portal.profiles`, RLS-hidden),
 * read only through the security-definer `player_identities` RPC.
 */
export interface PlayerIdentity {
    /** `null` without a portal pseudo: the UI localizes the fallback. */
    readonly name: string | null;
    /** Path in the portal's public avatars bucket. */
    readonly avatarPath: string | null;
}

const PORTAL_AVATAR_BUCKET = "avatars";

/** A new photo is a new path, so the URL is immutable. */
export function portalAvatarUrl(avatarPath: string | null): string | null {
    return avatarPath
        ? publicStorageUrl(PORTAL_AVATAR_BUCKET, avatarPath)
        : null;
}

/** Stable id prefix that keeps two pseudo-less players distinguishable. */
export function nameTag(userId: string): string {
    return userId.slice(0, 4);
}

/** Every requested id is present in the result (`name: null` when unknown). */
export async function identitiesByIds(
    client: SupabaseClient<Database>,
    ids: readonly string[],
): Promise<Map<string, PlayerIdentity>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const { data, error } = await client.rpc("player_identities", {
        p_ids: unique,
    });
    if (error) {
        console.error("[identities] lookup failed:", error.message);
    }
    const found = new Map((data ?? []).map((row) => [row.id, row]));
    return new Map(
        unique.map((id) => {
            const row = found.get(id);
            return [
                id,
                {
                    name: row?.pseudo ?? null,
                    avatarPath: row?.avatar_path ?? null,
                },
            ];
        }),
    );
}

/** Only ids with a pseudo are present. */
export async function usernamesByIds(
    client: SupabaseClient<Database>,
    ids: readonly string[],
): Promise<Map<string, string>> {
    const identities = await identitiesByIds(client, ids);
    return new Map(
        [...identities].flatMap(([id, { name }]) =>
            name === null ? [] : [[id, name] as const],
        ),
    );
}

export async function identityOf(
    client: SupabaseClient<Database>,
    userId: string,
): Promise<PlayerIdentity> {
    const [identity] = (await identitiesByIds(client, [userId])).values();
    return identity;
}
