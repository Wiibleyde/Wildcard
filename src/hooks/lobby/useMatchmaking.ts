"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, readApiError, readApiJson } from "@/lib/api/client";
import { useTicketChannel } from "@/lib/realtime/useTicketChannel";

type ServerStatus =
    | { status: "idle" }
    | { status: "searching"; moduleId: string; waiting: number }
    | { status: "matched"; gameId: string; code: string };

export type MatchState =
    | { phase: "idle" }
    | { phase: "searching"; moduleId: string; waiting: number; since: number }
    | { phase: "matched" }
    | { phase: "error"; code: string };

/** Drops the ticket whatever its state; a matched ticket holds a room, hence `all`. */
function consumeTicket(): void {
    apiFetch("/api/matchmaking?all=1", { method: "DELETE" }).catch(() => {});
}

export function useMatchmaking(userId: string) {
    const router = useRouter();
    const [state, setState] = useState<MatchState>({ phase: "idle" });
    // The realtime push and the POST response can both report "matched".
    const navigating = useRef(false);
    // A matched ticket seen before the user searched in this mount is a spent
    // one from a previous game: consume it rather than yank them back in.
    const active = useRef(false);

    const handleStatus = useCallback(
        (s: ServerStatus) => {
            if (s.status === "matched") {
                if (!active.current) {
                    consumeTicket();
                    setState({ phase: "idle" });
                    return;
                }
                if (navigating.current) return;
                navigating.current = true;
                setState({ phase: "matched" });
                consumeTicket();
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
        try {
            const res = await apiFetch("/api/matchmaking");
            const status = res.ok ? await readApiJson<ServerStatus>(res) : null;
            if (status) handleStatus(status);
        } catch {
            // Transient: the ticket channel's next doorbell/poll retries.
        }
    }, [handleStatus]);

    // useTicketChannel polls by itself while the socket is down.
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
            try {
                const res = await apiFetch("/api/matchmaking", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moduleId }),
                });
                if (!res.ok) {
                    const error = await readApiError(res);
                    // Already matched: the game exists, walk in rather than error.
                    if (error === "match_in_progress") {
                        await refresh();
                        return;
                    }
                    active.current = false;
                    setState({ phase: "error", code: error ?? "generic" });
                    return;
                }
                handleStatus(
                    (await readApiJson<ServerStatus>(res)) ?? {
                        status: "idle",
                    },
                );
            } catch {
                active.current = false;
                setState({ phase: "error", code: "generic" });
            }
        },
        [handleStatus, refresh],
    );

    const cancel = useCallback(async () => {
        // Also the way out of a "matched" overlay that never resolved.
        navigating.current = false;
        setState({ phase: "idle" });
        // Without `all`, only a still-searching ticket is dropped: a match that
        // landed in the click window survives and the refresh walks us in.
        await apiFetch("/api/matchmaking", { method: "DELETE" }).catch(
            () => {},
        );
        await refresh().catch(() => {});
    }, [refresh]);

    const playBots = useCallback(
        async (moduleId: string) => {
            navigating.current = true;
            active.current = true;
            setState({ phase: "matched" });
            try {
                const res = await apiFetch("/api/matchmaking/bots", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moduleId }),
                });
                const data = await readApiJson<{
                    error?: string;
                    gameId?: string;
                }>(res);
                if (!res.ok || !data?.gameId) {
                    navigating.current = false;
                    // A human match took our ticket meanwhile: the doorbell walks us in.
                    if (data?.error === "match_in_progress") return;
                    setState({
                        phase: "error",
                        code: data?.error ?? "generic",
                    });
                    return;
                }
                consumeTicket();
                router.push(`/game/${data.gameId}`);
            } catch {
                navigating.current = false;
                setState({ phase: "error", code: "generic" });
            }
        },
        [router],
    );

    return { state, quickMatch, cancel, playBots };
}
