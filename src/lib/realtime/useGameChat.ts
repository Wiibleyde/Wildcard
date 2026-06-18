"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** One chat line as held in the UI. `at` is the sender's clock (display only). */
export interface ChatMessage {
    readonly id: string;
    readonly userId: string;
    /**
     * Sender's display name, carried on the message itself. The chat channel
     * is open to spectators too, who are NOT in the game's seated `players`
     * list — so resolving names from that list dropped every spectator to "?".
     * A self-describing message needs no roster lookup and works for anyone on
     * the channel. (Chat is already client-trusted broadcast, so embedding the
     * name adds no new trust surface.)
     */
    readonly name: string;
    readonly text: string;
    readonly at: number;
}

/** Wire shape crossing the socket — kept tiny and mirrors {@link ChatMessage}. */
interface ChatWire {
    id: string;
    userId: string;
    name: string;
    text: string;
    at: number;
}

/** Outcome of a send attempt, so the UI can nudge on rejected input. */
export type SendResult =
    | "sent"
    | "empty"
    | "too_long"
    | "rate_limited"
    | "disconnected";

// ── Moderation knobs ─────────────────────────────────────────────────────────
// Client-side guardrails only. Broadcast is client-trusted (the message never
// passes through the server), so this is UX hygiene, not enforcement —
// authoritative moderation would require routing chat through an API Route /
// Edge Function. Scoped deliberately to the ticket: longueur + rate-limit.
/** Hard length cap — mirrored by the input's `maxLength` and clamped on receive. */
export const MAX_CHAT_LENGTH = 280;
/** Chat is ephemeral: keep only the tail in memory, not a full transcript. */
const MAX_MESSAGES = 50;
/** Minimum gap between two of *my* messages. */
const RATE_MIN_GAP_MS = 800;
/** ...and no more than this many inside the rolling window. */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_IN_WINDOW = 6;

// ── Reload-survival cache ────────────────────────────────────────────────────
// sessionStorage, not a DB: chat is ephemeral, so we only need history to
// survive an F5 within the same tab. It dies when the tab closes and is wiped
// when the game ends — nothing is persisted server-side (no schema, no RLS, no
// retention). A peer's messages sent *during* the reload gap aren't recoverable
// (broadcast has no replay) — that would need a DB table.
const CACHE_PREFIX = "wc:chat:";

function cacheKey(gameId: string): string {
    return `${CACHE_PREFIX}${gameId}`;
}

function isChatMessage(v: unknown): v is ChatMessage {
    if (typeof v !== "object" || v === null) return false;
    const m = v as Record<string, unknown>;
    return (
        typeof m.id === "string" &&
        typeof m.userId === "string" &&
        typeof m.name === "string" &&
        typeof m.text === "string" &&
        typeof m.at === "number"
    );
}

function loadCache(gameId: string): ChatMessage[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = sessionStorage.getItem(cacheKey(gameId));
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isChatMessage).slice(-MAX_MESSAGES);
    } catch {
        return [];
    }
}

function saveCache(gameId: string, messages: readonly ChatMessage[]): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(cacheKey(gameId), JSON.stringify(messages));
    } catch {
        // Storage disabled/full — we only lose reload-survival, not the chat.
    }
}

function clearCache(gameId: string): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(cacheKey(gameId));
    } catch {
        // Best-effort cleanup — ignore.
    }
}

/**
 * In-game chat over a **dedicated** Supabase Realtime broadcast channel
 * (`chat:game:<id>`), separate from {@link useGameChannel}. Two reasons it's
 * its own channel:
 * - chat is ephemeral and peer-to-peer (broadcast), not authoritative state —
 *   there's nothing to refetch, so it never rings the game's "doorbell";
 * - keeping it off the state channel means chatter can't trigger a board
 *   refetch — the ticket's *ne bloque pas le flux de jeu* guarantee.
 *
 * Public broadcast channel, so no auth gating: nothing private crosses it and
 * messages are display-only. Drops over a reconnect are simply lost, which is
 * how chat is expected to behave.
 *
 * History survives an F5 via a per-tab sessionStorage cache (see helpers
 * above): re-seeded on mount, persisted as it grows, and wiped once `isOver`
 * so a reload after the final hand starts clean.
 *
 * Returns the recent message tail and a `send` that applies the moderation
 * knobs above and echoes optimistically (channel is `self: false`).
 */
export function useGameChat(
    gameId: string,
    currentUserId: string,
    currentUserName: string,
    isOver: boolean,
) {
    const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const readyRef = useRef(false);
    const sentAtRef = useRef<number[]>([]);

    const append = useCallback((msg: ChatMessage) => {
        setMessages((prev) => {
            // Broadcast can redeliver across a rejoin — dedupe by id.
            if (prev.some((m) => m.id === msg.id)) return prev;
            const next = [...prev, msg];
            return next.length > MAX_MESSAGES
                ? next.slice(next.length - MAX_MESSAGES)
                : next;
        });
    }, []);

    useEffect(() => {
        const supabase = createClient();
        let channel: RealtimeChannel | undefined;
        let active = true;

        const onMessage = ({ payload }: { payload: unknown }) => {
            const p = payload as Partial<ChatWire> | null;
            if (!p || typeof p.id !== "string" || typeof p.text !== "string") {
                return;
            }
            append({
                id: p.id,
                userId: typeof p.userId === "string" ? p.userId : "?",
                // Empty when a peer omits it → the UI falls back to the
                // seated-roster lookup (works for players, not spectators).
                name: typeof p.name === "string" ? p.name : "",
                // Clamp defensively — a peer could broadcast an oversized string.
                text: p.text.slice(0, MAX_CHAT_LENGTH),
                at: typeof p.at === "number" ? p.at : Date.now(),
            });
        };

        // The session token MUST be set on the socket *before* subscribing, or
        // the cookie-based SSR client connects as `anon`. On a stack whose
        // Realtime authorization is `authenticated`-only (self-hosted default),
        // an anon socket is rejected — the channel never reaches SUBSCRIBED, so
        // every `send` below returns "disconnected" and the chat looks dead even
        // though the game (which polls) keeps working. Same setAuth dance as
        // {@link useRealtimeSync}; chat just never did it.
        const join = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active) return;
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
            channel = supabase
                .channel(`chat:game:${gameId}`, {
                    config: { broadcast: { self: false } },
                })
                .on("broadcast", { event: "message" }, onMessage)
                .subscribe((status) => {
                    readyRef.current = status === "SUBSCRIBED";
                });
            channelRef.current = channel;
        };

        // Keep the socket token fresh across the ~1h access-token refresh, so a
        // long game doesn't silently drop back to anon mid-session.
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                supabase.realtime.setAuth(session.access_token);
            }
        });

        join();

        return () => {
            active = false;
            readyRef.current = false;
            channelRef.current = null;
            subscription.unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    }, [gameId, append]);

    // Reload-survival: re-seed from the per-tab cache after mount (client-only,
    // so SSR renders an empty feed and there's no hydration mismatch).
    useEffect(() => {
        const cached = loadCache(gameId);
        if (cached.length === 0) return;
        setMessages((prev) => {
            if (prev.length === 0) return cached;
            const seen = new Set(prev.map((m) => m.id));
            return [...cached.filter((m) => !seen.has(m.id)), ...prev].slice(
                -MAX_MESSAGES,
            );
        });
    }, [gameId]);

    // Persist while the game runs; wipe the moment it's over so an F5 after the
    // final hand starts clean (the in-memory feed stays for the current tab).
    useEffect(() => {
        if (isOver) {
            clearCache(gameId);
            return;
        }
        if (messages.length > 0) saveCache(gameId, messages);
    }, [gameId, messages, isOver]);

    const send = useCallback(
        (raw: string): SendResult => {
            const text = raw.trim();
            if (text.length === 0) return "empty";
            if (text.length > MAX_CHAT_LENGTH) return "too_long";

            const now = Date.now();
            const recent = sentAtRef.current.filter(
                (t) => now - t < RATE_WINDOW_MS,
            );
            if (recent.length >= RATE_MAX_IN_WINDOW) return "rate_limited";
            const last = recent.at(-1);
            if (last !== undefined && now - last < RATE_MIN_GAP_MS) {
                return "rate_limited";
            }

            const channel = channelRef.current;
            if (!channel || !readyRef.current) return "disconnected";

            const msg: ChatMessage = {
                id: crypto.randomUUID(),
                userId: currentUserId,
                name: currentUserName,
                text,
                at: now,
            };
            sentAtRef.current = [...recent, now];
            // Optimistic echo: the channel is self:false, so the sender renders
            // its own line immediately instead of waiting on the round-trip.
            append(msg);
            channel.send({
                type: "broadcast",
                event: "message",
                payload: msg satisfies ChatWire,
            });
            return "sent";
        },
        [currentUserId, currentUserName, append],
    );

    return { messages, send };
}
