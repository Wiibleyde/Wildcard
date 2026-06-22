"use client";

import { useTranslations } from "next-intl";
import { type SyntheticEvent, useState } from "react";
import { useAutoScroll } from "@/hooks/game/useAutoScroll";
import { useTransientNotice } from "@/hooks/game/useTransientNotice";
import { buildSurfaceStyle } from "@/lib/board/styles";
import type { BoardTheme } from "@/lib/board/types";
import type { GamePlayer } from "@/lib/models/game";
import { MAX_CHAT_LENGTH, useGameChat } from "@/lib/realtime/useGameChat";
import { nameOf } from "./GameChrome";

interface GameChatProps {
    gameId: string;
    currentUserId: string;
    /** Viewer's own display name — stamped on the messages they send so
     * spectators (absent from `players`) still show a name, not "?". */
    currentUserName: string;
    players: readonly GamePlayer[];
    boardTheme: BoardTheme;
    /** Game finished — stops persisting and wipes the reload cache. */
    isOver: boolean;
}

export function GameChat({
    gameId,
    currentUserId,
    currentUserName,
    players,
    boardTheme,
    isOver,
}: GameChatProps) {
    const t = useTranslations("chat");
    const { messages, send } = useGameChat(
        gameId,
        currentUserId,
        currentUserName,
        isOver,
    );
    const [draft, setDraft] = useState("");
    // A rejected send must not vanish silently — surface why in the composer.
    const [notice, showNotice] = useTransientNotice<
        "rate_limited" | "disconnected"
    >();
    const listRef = useAutoScroll<HTMLOListElement>(messages);

    const onSubmit = (e: SyntheticEvent) => {
        e.preventDefault();
        const result = send(draft);
        if (result === "sent") {
            setDraft("");
        } else if (result === "rate_limited") {
            // Input keeps its text so nothing is lost.
            showNotice("rate_limited", 1500);
        } else if (result === "disconnected") {
            showNotice("disconnected", 2500);
        }
        // "empty" / "too_long" can't occur — the input guards both.
    };

    return (
        <section
            className="flex h-56 flex-col overflow-hidden rounded-2xl p-3 lg:h-auto lg:min-h-0 lg:w-60 lg:flex-2 lg:self-stretch xl:w-72 xl:p-4 2xl:w-80"
            style={buildSurfaceStyle(boardTheme)}
            aria-label={t("title")}
        >
            <h2
                className="mb-2 text-xs font-black uppercase tracking-widest"
                style={{ color: boardTheme.accentColor }}
            >
                {t("title")}
            </h2>

            <ol
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 text-xs xl:text-sm"
            >
                {messages.length === 0 ? (
                    <li className="text-white/50">{t("empty")}</li>
                ) : (
                    messages.map((m) => {
                        const mine = m.userId === currentUserId;
                        return (
                            <li
                                key={m.id}
                                className={
                                    mine ? "text-white/90" : "text-white/70"
                                }
                            >
                                <span
                                    className="font-bold"
                                    style={
                                        mine
                                            ? { color: boardTheme.accentColor }
                                            : undefined
                                    }
                                >
                                    {mine
                                        ? t("you")
                                        : m.name || nameOf(players, m.userId)}
                                </span>
                                <span className="text-white/40">: </span>
                                <span className="wrap-break-word">
                                    {m.text}
                                </span>
                            </li>
                        );
                    })
                )}
            </ol>

            <form onSubmit={onSubmit} className="mt-2 flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={MAX_CHAT_LENGTH}
                    placeholder={notice ? t(notice) : t("placeholder")}
                    aria-label={t("placeholder")}
                    className="min-w-0 flex-1 rounded-lg border bg-black/25 px-3 py-2 text-xs text-white/90 outline-none placeholder:text-white/40 xl:text-sm"
                    style={{ borderColor: notice ? "#e04040" : "#3d2d18" }}
                />
                <button
                    type="submit"
                    disabled={draft.trim().length === 0}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-black transition-opacity disabled:opacity-40 xl:text-sm"
                    style={{
                        background: boardTheme.accentColor,
                        color: "#0d0a05",
                    }}
                >
                    {t("send")}
                </button>
            </form>
        </section>
    );
}
