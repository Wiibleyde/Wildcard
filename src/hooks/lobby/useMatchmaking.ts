"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTicketChannel } from "@/lib/realtime/useTicketChannel";

/** Server ticket status, as returned by the matchmaking API. */
type ServerStatus =
    | { status: "idle" }
    | { status: "searching"; moduleId: string; waiting: number }
    | { status: "matched"; gameId: string; code: string };

/** UI-facing matchmaking state machine. */
export type MatchState =
    | { phase: "idle" }
    | { phase: "searching"; moduleId: string; waiting: number; since: number }
    | { phase: "matched" }
    | { phase: "error"; code: string };

/**
 * Drive the quick-match flow for a signed-in user. Enqueues, listens on the
 * caller's own ticket over Realtime (`useTicketChannel`), and walks everyone
 * into the dealt game the moment they're matched. `playBots` bails out of the
 * wait into a solo+bots game; `cancel` leaves the queue.
 */
export function useMatchmaking(userId: string) {
    const router = useRouter();
    const [state, setState] = useState<MatchState>({ phase: "idle" });
    // Guards against a double navigation when the realtime push and the POST
    // response both report "matched".
    const navigating = useRef(false);
    // True only once the user has started matchmaking *this mount*. A matched
    // ticket seen while this is false is a spent ticket from a previous game
    // (the backstop poll refetches status on every /lobby visit) — consume it
    // instead of yanking the player back into a finished game. This is what
    // stops "Leave game" → /lobby → instantly rejoined.
    const active = useRef(false);

    const handleStatus = useCallback(
        (s: ServerStatus) => {
            if (s.status === "matched") {
                if (!active.current) {
                    // Stale match — drop it (matched tickets hold a room_id, so
                    // this needs the unconditional clear) and stay put.
                    fetch("/api/matchmaking?all=1", {
                        method: "DELETE",
                    }).catch(() => {});
                    setState({ phase: "idle" });
                    return;
                }
                if (navigating.current) return;
                navigating.current = true;
                setState({ phase: "matched" });
                // Consume the spent ticket, then walk into the game.
                fetch("/api/matchmaking?all=1", { method: "DELETE" }).catch(
                    () => {},
                );
                router.push(`/game/${s.gameId}`);
                return;
            }
            if (s.status === "searching") {
                setState((prev) =>
                    prev.phase === "searching"
                        ? { ...prev, waiting: s.waiting }
                        : {
                              phase: "searching",
                              moduleId: s.moduleId,
                              waiting: s.waiting,
                              since: Date.now(),
                          },
                );
                return;
            }
            if (!navigating.current) setState({ phase: "idle" });
        },
        [router],
    );

    const refresh = useCallback(async () => {
        const res = await fetch("/api/matchmaking");
        if (res.ok) handleStatus((await res.json()) as ServerStatus);
    }, [handleStatus]);

    // Realtime doorbell on our ticket → refetch the authoritative status.
    useTicketChannel(userId, refresh);

    const quickMatch = useCallback(
        async (moduleId: string) => {
            navigating.current = false;
            active.current = true;
            setState({
                phase: "searching",
                moduleId,
                waiting: 1,
                since: Date.now(),
            });
            const res = await fetch("/api/matchmaking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setState({ phase: "error", code: data.error ?? "generic" });
                return;
            }
            handleStatus(data as ServerStatus);
        },
        [handleStatus],
    );

    const cancel = useCallback(async () => {
        active.current = false;
        setState({ phase: "idle" });
        await fetch("/api/matchmaking", { method: "DELETE" }).catch(() => {});
    }, []);

    const playBots = useCallback(
        async (moduleId: string) => {
            navigating.current = true;
            active.current = true;
            setState({ phase: "matched" });
            const res = await fetch("/api/matchmaking/bots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId }),
            });
            const data = await res.json();
            if (!res.ok) {
                navigating.current = false;
                setState({ phase: "error", code: data.error ?? "generic" });
                return;
            }
            // Consume the now-spent ticket so a later /lobby visit can't rejoin.
            fetch("/api/matchmaking?all=1", { method: "DELETE" }).catch(
                () => {},
            );
            router.push(`/game/${data.gameId}`);
        },
        [router],
    );

    return { state, quickMatch, cancel, playBots };
}
