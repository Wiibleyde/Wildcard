"use client";

import { useTranslations } from "next-intl";
import { type SyntheticEvent, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useAutoScroll } from "@/hooks/game/useAutoScroll";
import { useTransientNotice } from "@/hooks/game/useTransientNotice";
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
    /** Kept for the caller contract; the rail panel now uses the fixed
     * neobrutalism `.panel-d` chrome rather than the felt surface. */
    boardTheme: BoardTheme;
    /** Game finished — stops persisting and wipes the reload cache. */
    isOver: boolean;
}

export function GameChat({
    gameId,
    currentUserId,
    currentUserName,
    players,
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
            className="panel-d flex h-56 flex-col overflow-hidden p-3 lg:h-auto lg:min-h-0 lg:w-60 lg:flex-2 lg:self-stretch xl:w-72 xl:p-4 2xl:w-80"
            aria-label={t("title")}
        >
            <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-lg leading-none text-wc-cream">
                    {t("title")}
                </h2>
                <span
                    className="stamp"
                    style={{
                        background: "var(--blue)",
                        color: "var(--accent-ink)",
                    }}
                >
                    CHAT
                </span>
            </div>

            <ol
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 text-xs xl:text-sm"
            >
                {messages.length === 0 ? (
                    <li className="text-wc-muted">{t("empty")}</li>
                ) : (
                    messages.map((m) => {
                        const mine = m.userId === currentUserId;
                        return (
                            <li
                                key={m.id}
                                className={
                                    mine ? "text-wc-cream" : "text-wc-cream/80"
                                }
                            >
                                <span
                                    className="font-display text-xs"
                                    style={{
                                        color: mine
                                            ? "var(--gold)"
                                            : "var(--blue)",
                                    }}
                                >
                                    {mine
                                        ? t("you")
                                        : m.name || nameOf(players, m.userId)}
                                </span>
                                <span className="text-wc-muted">: </span>
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
                    className="min-w-0 flex-1 rounded-wc-icon border-nb bg-wc-cream px-3 py-2 text-xs text-wc-ink outline-none placeholder:text-wc-ink/50 xl:text-sm"
                    style={{
                        borderColor: notice ? "var(--red)" : "var(--ink)",
                    }}
                />
                <GameButton
                    type="submit"
                    variant="gold"
                    size="sm"
                    disabled={draft.trim().length === 0}
                    className="shrink-0"
                >
                    {t("send")}
                </GameButton>
            </form>
        </section>
    );
}
