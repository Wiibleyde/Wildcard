import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
    GAME_VERSION_EVENT,
    type GameVersionSignal,
    gameTopic,
} from "@/lib/realtime/topics";

/** A doorbell that cannot ring promptly is useless: never hold the caller. */
const SEND_TIMEOUT_MS = 2000;

/**
 * Broadcast the committed `version` over Realtime's REST endpoint. Broadcast,
 * not only CDC: self-hosted CDC can look subscribed while delivering nothing.
 * Clients treat it as an untrusted hint and re-read through the API, so a
 * forged ring costs one read. Never throws; the heartbeat poll covers a miss.
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
        // REST-only send: the channel was never joined.
        if (channel) void admin.removeChannel(channel).catch(() => {});
    }
}
