import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameOutcome } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";
import { computeXpAwards } from "@/lib/xp/xp";

type Admin = SupabaseClient<Database>;

/**
 * Persist XP for one finished game — **server-only**.
 *
 * Called from the game-finish path alongside ELO. Best-effort: XP is a derived
 * progression stat, never on the critical path of a move, so any failure is
 * swallowed rather than failing the player's action.
 *
 * Every human participant earns XP (participation + win bonus); bots are
 * filtered out. A single atomic RPC applies all awards.
 */
export async function recordXpForGame(
    admin: Admin,
    outcome: GameOutcome | null,
    botIds: readonly string[],
): Promise<void> {
    if (!outcome) return;

    const awards = computeXpAwards(outcome.rankings, outcome.winners, botIds);
    if (awards.length === 0) return;

    try {
        await admin.rpc("award_game_xp", {
            p_awards: awards.map((a) => ({
                user_id: a.playerId,
                amount: a.amount,
            })),
        });
    } catch {
        // XP is best-effort — swallow so a stats hiccup never breaks play.
    }
}
