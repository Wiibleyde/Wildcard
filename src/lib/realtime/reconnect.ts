/**
 * Pure reconnect logic for {@link useRealtimeSync}, split out so the backoff
 * math and channel-status mapping are unit-testable in a node env — without a
 * DOM, a live socket, or Supabase. The hook wires these into React effects.
 */

/**
 * Connection health surfaced to the UI. `connecting` is the first join,
 * `reconnecting` is any gap after a drop (CHANNEL_ERROR / TIMED_OUT / CLOSED)
 * while we re-join, `connected` is a live subscription.
 */
export type RealtimeStatus = "connecting" | "connected" | "reconnecting";

/**
 * Capped exponential backoff between successive re-join attempts: 1s, 2s, 4s,
 * 8s … capped at 10s. `attempt` is 0-based (the first retry passes 0), so a
 * flapping network never hammers the socket.
 */
export function backoffDelay(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 10_000);
}

/** Channel statuses meaning the subscription is gone and must be re-joined. */
const REJOIN_STATUSES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

/**
 * Map a Supabase channel `.subscribe` status to the UI health and whether a
 * re-join must be scheduled. Returns `null` for statuses we don't act on (e.g.
 * the intermediate `JOINING`), so the caller leaves current state untouched.
 */
export function classifyChannelStatus(
    status: string,
): { status: RealtimeStatus; rejoin: boolean } | null {
    if (status === "SUBSCRIBED") return { status: "connected", rejoin: false };
    if (REJOIN_STATUSES.has(status)) {
        return { status: "reconnecting", rejoin: true };
    }
    return null;
}
