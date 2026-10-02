"use client";

import type {
    RealtimeChannel,
    RealtimeChannelOptions,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeStatus } from "@/lib/realtime/reconnect";
import { CHAT_MESSAGE_EVENT, chatTopic } from "@/lib/realtime/topics";
import { useAuthedChannel } from "@/lib/realtime/useAuthedChannel";

/** `at` is the sender's clock (display only). */
export interface ChatMessage {
    readonly id: string;
    readonly userId: string;
    /** Carried on the message: spectators are not in the seated roster. */
    readonly name: string;
    readonly text: string;
    readonly at: number;
}

export type SendResult =
    | "sent"
    | "empty"
    | "too_long"
    | "rate_limited"
    | "disconnected";

// Peer-to-peer broadcast never passes through the server: these limits are UX
// hygiene, not enforcement.
export const MAX_CHAT_LENGTH = 280;
const MAX_MESSAGES = 50;
const RATE_MIN_GAP_MS = 800;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_IN_WINDOW = 6;

/** The sender echoes its own line optimistically. */
const CHANNEL_OPTIONS: RealtimeChannelOptions = {
    config: { broadcast: { self: false } },
};

// Per-tab sessionStorage: history survives an F5, nothing is stored server-side.
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
        // Storage disabled or full: only reload-survival is lost.
    }
}

function clearCache(gameId: string): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(cacheKey(gameId));
    } catch {
        // Best-effort.
    }
}

/** Ephemeral in-game chat on its own broadcast channel; the cache is wiped once `isOver`. */
export function useGameChat(
    gameId: string,
    currentUserId: string,
    currentUserName: string,
    isOver: boolean,
) {
    const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
    const readyRef = useRef(false);
    const sentAtRef = useRef<number[]>([]);

    const append = useCallback((msg: ChatMessage) => {
        setMessages((prev) => {
            // Broadcast can redeliver across a rejoin.
            if (prev.some((m) => m.id === msg.id)) return prev;
            const next = [...prev, msg];
            return next.length > MAX_MESSAGES
                ? next.slice(next.length - MAX_MESSAGES)
                : next;
        });
    }, []);

    const build = useCallback(
        (channel: RealtimeChannel) =>
            channel.on(
                "broadcast",
                { event: CHAT_MESSAGE_EVENT },
                ({ payload }: { payload: unknown }) => {
                    const p = payload as Partial<ChatMessage> | null;
                    if (
                        !p ||
                        typeof p.id !== "string" ||
                        typeof p.text !== "string"
                    ) {
                        return;
                    }
                    append({
                        id: p.id,
                        userId: typeof p.userId === "string" ? p.userId : "?",
                        name: typeof p.name === "string" ? p.name : "",
                        // A peer could broadcast an oversized string.
                        text: p.text.slice(0, MAX_CHAT_LENGTH),
                        at: typeof p.at === "number" ? p.at : Date.now(),
                    });
                },
            ),
        [append],
    );
    const onStatus = useCallback((status: RealtimeStatus) => {
        readyRef.current = status === "connected";
    }, []);
    const channelRef = useAuthedChannel(
        chatTopic(gameId),
        build,
        onStatus,
        CHANNEL_OPTIONS,
    );

    // Client-only re-seed, so SSR renders an empty feed (no hydration mismatch).
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
            append(msg);
            // A refused send nobody received must not stay in the sender's feed.
            void channel
                .send({
                    type: "broadcast",
                    event: CHAT_MESSAGE_EVENT,
                    payload: msg,
                })
                .then(
                    (result) => result === "ok",
                    () => false,
                )
                .then((delivered) => {
                    if (!delivered) {
                        setMessages((prev) =>
                            prev.filter((m) => m.id !== msg.id),
                        );
                    }
                });
            return "sent";
        },
        [currentUserId, currentUserName, append, channelRef],
    );

    return { messages, send };
}
