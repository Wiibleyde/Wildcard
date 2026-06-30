"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMatchmaking } from "@/hooks/lobby/useMatchmaking";
import { useRoomAction } from "@/hooks/lobby/useRoomAction";
import { GAME_CATEGORIES, type PlayGame } from "@/lib/games/catalog";
import { GameCard } from "./GameCard";
import { MatchmakingOverlay } from "./MatchmakingOverlay";

interface Props {
    readonly userId: string;
    readonly games: PlayGame[];
}

const DIFFICULTY_KEY = [
    "",
    "difficulty_easy",
    "difficulty_medium",
    "difficulty_hard",
] as const;

export function PlayHub({ userId, games }: Props) {
    const t = useTranslations("lobby");
    const tg = useTranslations("games");
    const { state, quickMatch, cancel, playBots } = useMatchmaking(userId);
    const { busy, error: roomError, createRoom, joinRoom } = useRoomAction();
    const [code, setCode] = useState("");

    const sections = GAME_CATEGORIES.map((cat) => ({
        id: cat.id,
        accent: cat.accent,
        label: tg(`cat_${cat.id}` as "cat_duel"),
        games: games.filter((g) => g.category === cat.id),
    })).filter((s) => s.games.length > 0);

    function metaFor(g: PlayGame) {
        const players =
            g.maxPlayers === 1
                ? tg("players_solo")
                : g.minPlayers === g.maxPlayers
                  ? tg("players_exact", { n: g.minPlayers })
                  : tg("players_range", {
                        min: g.minPlayers,
                        max: g.maxPlayers,
                    });
        return {
            categoryLabel: tg(`cat_${g.category}` as "cat_duel"),
            description: tg(`desc_${g.id}` as "desc_bataille"),
            meta: {
                players,
                duration: tg("duration", { min: g.durationMin }),
                difficulty: tg(DIFFICULTY_KEY[g.difficulty]),
                comingSoon: tg("coming_soon"),
            },
        };
    }

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
            <section
                className="flex flex-col gap-4 rounded-2xl p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between"
                style={{ background: "#1c1510", border: "2px solid #3d2d18" }}
            >
                <div className="flex flex-col gap-0.5">
                    <h2
                        className="text-lg font-black"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("join_title")}
                    </h2>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {t("join_subtitle")}
                    </p>
                </div>
                <div className="flex gap-3">
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder={t("code_placeholder")}
                        maxLength={5}
                        className="min-w-0 flex-1 rounded-xl px-4 py-3 text-center font-black tracking-[0.3em] outline-none lg:w-44"
                        style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "2px solid #3d2d18",
                            color: "#faf2e2",
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => joinRoom(code)}
                        disabled={busy !== null || code.length < 3}
                        className="shrink-0 rounded-xl px-6 py-3 font-black text-sm transition-transform active:scale-95 disabled:opacity-50"
                        style={{
                            background: "#f5c516",
                            color: "#0d0a05",
                            boxShadow: "0 4px 0 0 #8a6800",
                        }}
                    >
                        {busy === "join" ? t("joining") : t("join_room")}
                    </button>
                </div>
            </section>

            {errorText && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-semibold"
                    style={{
                        background: "rgba(224,64,64,0.1)",
                        border: "1px solid rgba(224,64,64,0.3)",
                        color: "#e04040",
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
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: section.accent }}
                        >
                            {section.label}
                        </h2>
                        <span
                            className="h-px flex-1"
                            style={{ background: "#2a2012" }}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {section.games.map((g) => {
                            const { categoryLabel, description, meta } =
                                metaFor(g);
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
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        quickMatch(g.id)
                                                    }
                                                    disabled={busy !== null}
                                                    className="rounded-xl py-2.5 font-black text-sm transition-transform active:scale-95 disabled:opacity-50"
                                                    style={{
                                                        background: g.accent,
                                                        color: "#0d0a05",
                                                        boxShadow: `0 3px 0 0 ${g.shadow}`,
                                                    }}
                                                >
                                                    {t("quick_match")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        createRoom(
                                                            g.id,
                                                            "private",
                                                        )
                                                    }
                                                    disabled={busy !== null}
                                                    className="rounded-xl py-2.5 font-bold text-sm transition-transform active:scale-95 disabled:opacity-50"
                                                    style={{
                                                        background:
                                                            "rgba(255,255,255,0.04)",
                                                        color: "#faf2e2",
                                                        border: `2px solid ${g.accent}40`,
                                                    }}
                                                >
                                                    {busy === "create"
                                                        ? t("creating")
                                                        : t("create_private")}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    createRoom(g.id, "private")
                                                }
                                                disabled={busy !== null}
                                                className="rounded-xl py-2.5 font-black text-sm transition-transform active:scale-95 disabled:opacity-50"
                                                style={{
                                                    background: g.accent,
                                                    color: "#0d0a05",
                                                    boxShadow: `0 3px 0 0 ${g.shadow}`,
                                                }}
                                            >
                                                {busy === "create"
                                                    ? t("creating")
                                                    : t("play_solo")}
                                            </button>
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
