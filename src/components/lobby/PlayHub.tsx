"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useMatchmaking } from "@/hooks/lobby/useMatchmaking";
import { useRoomAction } from "@/hooks/lobby/useRoomAction";
import type { PlayGame } from "@/lib/games/catalog";
import {
    buildPlaySections,
    gameLabels,
    type Translate,
} from "@/lib/games/catalogView";
import { GameCard } from "./GameCard";
import { MatchmakingOverlay } from "./MatchmakingOverlay";

interface Props {
    readonly userId: string;
    readonly games: PlayGame[];
}

export function PlayHub({ userId, games }: Props) {
    const t = useTranslations("lobby");
    // Loosen next-intl's strict key type for the catalog view's dynamic keys.
    const tg = useTranslations("games") as unknown as Translate;
    const { state, quickMatch, cancel, playBots } = useMatchmaking(userId);
    const { busy, error: roomError, createRoom, joinRoom } = useRoomAction();
    const [code, setCode] = useState("");

    const sections = buildPlaySections(games, tg);

    const activeGame =
        state.phase === "searching"
            ? games.find((g) => g.id === state.moduleId)
            : undefined;
    const showOverlay =
        state.phase === "searching" || state.phase === "matched";
    const errorText =
        state.phase === "error"
            ? t("error_generic")
            : roomError
              ? roomError
              : null;

    return (
        <div className="flex flex-col gap-8">
            {/* Join a private game by code. */}
            <section className="panel flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    {/* Search glyph tile. */}
                    <span
                        aria-hidden
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{
                            background: "var(--red)",
                            color: "var(--accent-ink)",
                            border: "2.5px solid var(--ink)",
                            boxShadow: "0 4px 0 var(--ink)",
                            transform: "rotate(-4deg)",
                        }}
                    >
                        🔎
                    </span>
                    <div className="flex flex-col gap-0.5">
                        <h2
                            className="font-display text-xl leading-tight"
                            style={{ color: "var(--ink)" }}
                        >
                            {t("join_title")}
                        </h2>
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#5a5340" }}
                        >
                            {t("join_subtitle")}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder={t("code_placeholder")}
                        maxLength={5}
                        className="min-w-0 flex-1 rounded-xl px-4 py-3 text-center outline-none lg:w-44"
                        style={{
                            background: "var(--cream2)",
                            border: "2.5px solid var(--ink)",
                            color: "var(--ink)",
                            fontFamily: "var(--pixel)",
                            letterSpacing: "0.3em",
                            fontSize: "15px",
                            boxShadow: "inset 0 2px 0 rgba(11,18,32,0.12)",
                        }}
                    />
                    <GameButton
                        variant="red"
                        size="sm"
                        onClick={() => joinRoom(code)}
                        disabled={busy !== null || code.length < 3}
                        className="shrink-0"
                    >
                        {busy === "join" ? t("joining") : t("join_room")}
                    </GameButton>
                </div>
            </section>

            {errorText && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                        background: "var(--red)",
                        border: "2.5px solid var(--ink)",
                        boxShadow: "0 4px 0 var(--ink)",
                        color: "var(--accent-ink)",
                    }}
                >
                    {errorText}
                </p>
            )}

            {/* Categorised game catalog. */}
            {sections.map((section) => (
                <section key={section.id} className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <h2
                            className="wc-chip font-display"
                            style={{
                                padding: "8px 14px",
                                borderRadius: 11,
                                border: "2.5px solid var(--ink)",
                                boxShadow: "0 3px 0 var(--ink)",
                                background: section.accent,
                                color: "var(--ink)",
                                fontSize: "14px",
                            }}
                        >
                            {section.label}
                        </h2>
                        <span
                            className="h-0.5 flex-1 rounded-full"
                            style={{ background: "var(--bg-line)" }}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {section.games.map((g) => {
                            const { categoryLabel, description, meta } =
                                gameLabels(g, tg);
                            return (
                                <GameCard
                                    key={g.id}
                                    game={g}
                                    categoryLabel={categoryLabel}
                                    description={description}
                                    meta={meta}
                                    footer={
                                        g.matchmaking ? (
                                            <>
                                                <GameButton
                                                    variant="red"
                                                    size="sm"
                                                    onClick={() =>
                                                        quickMatch(g.id)
                                                    }
                                                    disabled={busy !== null}
                                                    className="w-full"
                                                >
                                                    {t("quick_match")}
                                                </GameButton>
                                                <GameButton
                                                    variant="gold"
                                                    size="sm"
                                                    onClick={() =>
                                                        createRoom(
                                                            g.id,
                                                            "private",
                                                        )
                                                    }
                                                    disabled={busy !== null}
                                                    className="w-full"
                                                >
                                                    {busy === "create"
                                                        ? t("creating")
                                                        : t("create_private")}
                                                </GameButton>
                                            </>
                                        ) : (
                                            <GameButton
                                                variant="red"
                                                size="sm"
                                                onClick={() =>
                                                    createRoom(g.id, "private")
                                                }
                                                disabled={busy !== null}
                                                className="w-full"
                                            >
                                                {busy === "create"
                                                    ? t("creating")
                                                    : t("play_solo")}
                                            </GameButton>
                                        )
                                    }
                                />
                            );
                        })}
                    </div>
                </section>
            ))}

            {showOverlay && (
                <MatchmakingOverlay
                    game={activeGame}
                    matched={state.phase === "matched"}
                    waiting={state.phase === "searching" ? state.waiting : 0}
                    since={state.phase === "searching" ? state.since : 0}
                    onCancel={cancel}
                    onPlayBots={() => activeGame && playBots(activeGame.id)}
                />
            )}
        </div>
    );
}
