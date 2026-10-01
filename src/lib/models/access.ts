import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * Positive decisions are memoised briefly: the version probe is polled every
 * ~800ms per viewer, and re-running four lookups on each tick would multiply
 * the hot path's DB load. Access is effectively monotonic during a game (a
 * room never turns private mid-game; a seat is never revoked), so a short TTL
 * is safe. Negative decisions are never cached — joining a room takes effect
 * immediately. Process-local, bounded, like the rate limiter.
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
        // Still full of live entries: drop the oldest insertion.
        if (grants.size >= GRANT_CACHE_MAX) {
            const oldest = grants.keys().next();
            if (!oldest.done) grants.delete(oldest.value);
        }
    }
    grants.set(key, now + GRANT_TTL_MS);
}

/**
 * May `userId` read game `gameId` (full redacted payload or version probe)?
 *
 * The game routes read through the service-role client — RLS does not apply —
 * so this is the authorization step that RLS would otherwise perform. Access is
 * granted, cheapest check first, when any of these holds:
 *
 * 1. the game's room is **public** — spectator mode is a feature: anyone
 *    signed in may watch a public table;
 * 2. the user has a `room_players` row in that room (seated player or a
 *    spectator who joined the lobby by code);
 * 3. the user is seated in the engine state (`state.players`) — covers a
 *    player who has since left the lobby row but still owns the seat;
 * 4. the user is a moderator+ (the live-games dashboard links to any game).
 *
 * Returns `false` for an unknown game as well, so callers answer 404 in both
 * cases and a private game's existence is not disclosed.
 *
 * Note: `view()` still redacts per viewer — granting read access to a
 * spectator never reveals a hand. This check only stops strangers from
 * watching private games (and from kicking their bot loop via the read path).
 */
export async function canViewGame(
    admin: Admin,
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
    admin: Admin,
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

    // Fail closed on errors, but leave a trace: a silent DB failure here would
    // look like "this game doesn't exist" to a legitimate player.
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
