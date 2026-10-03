"use client";

import { useTranslations } from "next-intl";
import { type SyntheticEvent, useId, useState } from "react";
import { Input } from "@/components/nb/input";
import { GameButton } from "@/components/ui/GameButton";
import { useAutoScroll } from "@/hooks/game/useAutoScroll";
import { usePlayerNames } from "@/hooks/game/usePlayerNames";
import { useTransientNotice } from "@/hooks/game/useTransientNotice";
import type { GamePlayer } from "@/lib/models/game";
import { MAX_CHAT_LENGTH, useGameChat } from "@/lib/realtime/useGameChat";
import { RailPanel } from "./RailPanel";

interface GameChatProps {
    gameId: string;
    currentUserId: string;
    /** Stamped on sent messages: spectators are absent from `players`. */
    currentUserName: string;
    players: readonly GamePlayer[];
    botIds: readonly string[];
    /** Stops persisting and wipes the reload cache. */
    isOver: boolean;
}

export function GameChat({
    gameId,
    currentUserId,
    currentUserName,
    players,
    botIds,
    isOver,
}: GameChatProps) {
    const t = useTranslations("chat");
    const { nameOf } = usePlayerNames(players, botIds);
    const { messages, send } = useGameChat(
        gameId,
        currentUserId,
        currentUserName,
        isOver,
    );
    const [draft, setDraft] = useState("");
    const [notice, showNotice] = useTransientNotice<
        "rate_limited" | "disconnected"
    >();
    const listRef = useAutoScroll<HTMLOListElement>(messages);
    const noticeId = useId();

    const onSubmit = (e: SyntheticEvent) => {
        e.preventDefault();
        const result = send(draft);
        if (result === "sent") {
            setDraft("");
        } else if (result === "rate_limited") {
            showNotice("rate_limited", 1500);
        } else if (result === "disconnected") {
            showNotice("disconnected", 2500);
        }
        // "empty" / "too_long" can't occur: the input guards both.
    };

    return (
        <RailPanel
            title={t("title")}
            stamp={t("badge")}
            tone="blue"
            className="h-56 lg:flex-2"
        >
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
                                        : m.name || nameOf(m.userId)}
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
                <Input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={MAX_CHAT_LENGTH}
                    placeholder={t("placeholder")}
                    aria-label={t("placeholder")}
                    aria-invalid={notice !== null}
                    aria-describedby={noticeId}
                    className="h-auto min-w-0 flex-1 rounded-wc-icon border-nb bg-wc-cream px-3 py-2 text-xs text-wc-ink aria-invalid:border-wc-red xl:text-sm"
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
            {/* Always-mounted live region with a reserved line: announced, and the panel never jumps. */}
            <output
                id={noticeId}
                aria-live="polite"
                className="mt-1 block h-4 truncate text-wc-label font-bold xl:text-xs"
                style={{ color: "var(--red)" }}
            >
                {notice ? t(notice) : ""}
            </output>
        </RailPanel>
    );
}
