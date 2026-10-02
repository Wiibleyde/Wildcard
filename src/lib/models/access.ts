import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { AdminClient } from "@/lib/supabase/admin";

/**
 * Positive decisions only, briefly: the version probe is polled per viewer,
 * and access is monotonic during a game. Negative decisions are never cached.
 */
const GRANT_TTL_MS = 30_000;
const GRANT_CACHE_MAX = 5_000;
const grants = new Map<string, number>();

function cachedGrant(key: string, now: number): boolean {
    const expiresAt = grants.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt > now) return true;
    grants.delete(key);
    return false;
}

function rememberGrant(key: string, now: number): void {
    if (grants.size >= GRANT_CACHE_MAX) {
        for (const [k, exp] of grants) if (exp <= now) grants.delete(k);
        if (grants.size >= GRANT_CACHE_MAX) {
            const oldest = grants.keys().next();
            if (!oldest.done) grants.delete(oldest.value);
        }
    }
    grants.set(key, now + GRANT_TTL_MS);
}

/**
 * Authorization for service-role game reads (RLS does not apply): public room,
 * room member, seated in the state, or moderator+. Fails closed, and an
 * unknown game is `false` too, so a private game's existence is not disclosed.
 * `view()` still redacts per viewer.
 */
export async function canViewGame(
    admin: AdminClient,
    gameId: string,
    userId: string,
): Promise<boolean> {
    const key = `${gameId}:${userId}`;
    const now = Date.now();
    if (cachedGrant(key, now)) return true;
    const granted = await checkViewAccess(admin, gameId, userId);
    if (granted) rememberGrant(key, now);
    return granted;
}

async function checkViewAccess(
    admin: AdminClient,
    gameId: string,
    userId: string,
): Promise<boolean> {
    const { data: game, error: gameError } = await admin
        .from("games")
        .select("room_id")
        .eq("id", gameId)
        .maybeSingle();
    if (gameError) {
        console.error("[access] game lookup failed:", gameError.message);
        return false;
    }
    if (!game) return false;

    const [room, membership, seat] = await Promise.all([
        admin
            .from("rooms")
            .select("visibility")
            .eq("id", game.room_id)
            .maybeSingle(),
        admin
            .from("room_players")
            .select("user_id")
            .eq("room_id", game.room_id)
            .eq("user_id", userId)
            .maybeSingle(),
        admin
            .from("game_states")
            .select("game_id")
            .eq("game_id", gameId)
            .contains("state", { players: [{ id: userId }] })
            .maybeSingle(),
    ]);

    if (room.data?.visibility === "public") return true;
    if (membership.data) return true;
    if (seat.data) return true;

    for (const res of [room, membership, seat]) {
        if (res.error) {
            console.error(
                "[access] membership lookup failed:",
                res.error.message,
            );
        }
    }

    return roleAtLeast(await getUserRole(admin, userId), "moderator");
}
