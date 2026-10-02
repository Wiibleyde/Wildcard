// Pure parts of the reconnect logic, unit-testable without a DOM or socket.

/** `reconnecting` = any gap after an established connection dropped. */
export type RealtimeStatus = "connecting" | "connected" | "reconnecting";

/** 1s, 2s, 4s, 8s, then capped at 10s; `attempt` is 0-based. */
export function backoffDelay(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 10_000);
}

const REJOIN_STATUSES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

/** `null` for statuses that change nothing (e.g. `JOINING`). */
export function classifyChannelStatus(
    status: string,
): { status: RealtimeStatus; rejoin: boolean } | null {
    if (status === "SUBSCRIBED") return { status: "connected", rejoin: false };
    if (REJOIN_STATUSES.has(status)) {
        return { status: "reconnecting", rejoin: true };
    }
    return null;
}
