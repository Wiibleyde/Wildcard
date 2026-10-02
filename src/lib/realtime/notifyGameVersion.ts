import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
    GAME_VERSION_EVENT,
    type GameVersionSignal,
    gameTopic,
} from "@/lib/realtime/topics";

/** A doorbell that cannot ring promptly is useless — don't hold the caller. */
const SEND_TIMEOUT_MS = 2000;

/**
 * Ring the game's doorbell: broadcast the freshly committed `version` on the
 * game topic, server-side, through Realtime's REST endpoint.
 *
 * Why Broadcast and not only `postgres_changes`: CDC on the self-hosted stack
 * can report a channel as subscribed while delivering nothing, which forced
 * every client into a sub-second HTTP poll. A server broadcast does not go
 * through the WAL at all, so a subscribed client reliably hears each move and
 * the poll can drop to a slow heartbeat.
 *
 * The payload is a bare version number — public meta, never state. Clients
 * treat it as an untrusted hint ("something changed, ask the server"): the
 * board only ever renders what the authenticated API returns, so a forged
 * broadcast can at worst trigger one extra read.
 *
 * Best-effort and never throws: a missed bell is caught by the client's
 * heartbeat poll.
 */
export async function notifyGameVersion(
    admin: Pick<SupabaseClient, "channel" | "removeChannel">,
    gameId: string,
    version: number,
): Promise<void> {
    let channel: RealtimeChannel | undefined;
    try {
        channel = admin.channel(gameTopic(gameId));
        const res = await channel.httpSend(
            GAME_VERSION_EVENT,
            { version } satisfies GameVersionSignal,
            { timeout: SEND_TIMEOUT_MS },
        );
        if (!res.success) {
            console.error(
                `[realtime] game ${gameId}: version broadcast refused (${res.status}): ${res.error}`,
            );
        }
    } catch (err) {
        console.error(
            `[realtime] game ${gameId}: version broadcast failed:`,
            err,
        );
    } finally {
        // REST-only send: the channel was never joined, just drop it.
        if (channel) void admin.removeChannel(channel).catch(() => {});
    }
}
