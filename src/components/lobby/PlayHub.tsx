"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { useMatchmaking } from "@/hooks/lobby/useMatchmaking";
import { useRoomAction } from "@/hooks/lobby/useRoomAction";
import { useApiErrorLabel } from "@/hooks/useApiErrorLabel";
import type { PlayGame } from "@/lib/games/catalog";
import {
    buildPlaySections,
    gameLabels,
    type Translate,
} from "@/lib/games/catalogView";
import { CODE_LENGTH } from "@/lib/models/roomCode";
import type { PublishedEcaGame } from "@/lib/models/studio";
import { CommunityGames } from "./CommunityGames";
import { GameCard } from "./GameCard";
import { MatchmakingOverlay } from "./MatchmakingOverlay";

interface Props {
    readonly userId: string;
    readonly games: PlayGame[];
    readonly community: readonly PublishedEcaGame[];
}

export function PlayHub({ userId, games, community }: Props) {
    const t = useTranslations("lobby");
    const errorLabel = useApiErrorLabel();
    // catalogView builds its keys dynamically (`cat_${id}`) and takes a loose translator.
    const tg = useTranslations("games") as unknown as Translate;
    const { state, quickMatch, cancel, playBots } = useMatchmaking(userId);
    // One room action for the whole page: a single busy state and error banner.
    const room = useRoomAction();
    const [code, setCode] = useState("");

    const sections = buildPlaySections(games, tg);
    const busy = room.busy !== null;

    const activeGame =
        state.phase === "searching"
            ? games.find((g) => g.id === state.moduleId)
            : undefined;
    const errorText =
        state.phase === "error" ? errorLabel(state.code) : room.error;

    function createLabel(moduleId: string, idle: string): string {
        return room.busyModuleId === moduleId ? t("creating") : idle;
    }

    return (
        <div className="flex flex-col gap-8">
            <section className="panel flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-nb border-wc-ink bg-wc-red text-xl"
                        style={{
                            boxShadow: "0 4px 0 var(--ink)",
                            transform: "rotate(-4deg)",
                        }}
                    >
                        🔎
                    </span>
                    <div className="flex flex-col gap-0.5">
                        <h2 className="font-display text-xl leading-tight text-wc-ink">
                            {t("join_title")}
                        </h2>
                        <p className="text-sm font-semibold text-wc-ink-soft">
                            {t("join_subtitle")}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder={t("code_placeholder")}
                        aria-label={t("code_label")}
                        autoComplete="off"
                        maxLength={CODE_LENGTH}
                        className="min-w-0 flex-1 rounded-xl border-nb border-wc-ink bg-wc-cream2 px-4 py-3 text-center font-pixel text-[15px] tracking-[0.3em] text-wc-ink outline-none lg:w-44"
                        style={{
                            boxShadow: "inset 0 2px 0 rgba(11,18,32,0.12)",
                        }}
                    />
                    <GameButton
                        variant="red"
                        size="sm"
                        onClick={() => room.joinRoom(code)}
                        disabled={busy || code.length !== CODE_LENGTH}
                        className="shrink-0"
                    >
                        {room.busy?.action === "join"
                            ? t("joining")
                            : t("join_room")}
                    </GameButton>
                </div>
            </section>

            {errorText && <ErrorBanner>{errorText}</ErrorBanner>}

            {sections.map((section) => (
                <section key={section.id} className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <h2
                            className="wc-chip rounded-[11px] border-nb border-wc-ink px-3.5 py-2 font-display text-sm text-wc-ink"
                            style={{
                                boxShadow: "0 3px 0 var(--ink)",
                                background: section.accent,
                            }}
                        >
                            {section.label}
                        </h2>
                        <span className="h-0.5 flex-1 rounded-full bg-wc-bg-line" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                                                    disabled={busy}
                                                    className="w-full"
                                                >
                                                    {t("quick_match")}
                                                </GameButton>
                                                <GameButton
                                                    variant="gold"
                                                    size="sm"
                                                    onClick={() =>
                                                        room.createRoom(g.id)
                                                    }
                                                    disabled={busy}
                                                    className="w-full"
                                                >
                                                    {createLabel(
                                                        g.id,
                                                        t("create_private"),
                                                    )}
                                                </GameButton>
                                            </>
                                        ) : (
                                            <GameButton
                                                variant="red"
                                                size="sm"
                                                onClick={() =>
                                                    room.createRoom(g.id)
                                                }
                                                disabled={busy}
                                                className="w-full"
                                            >
                                                {createLabel(
                                                    g.id,
                                                    t("play_solo"),
                                                )}
                                            </GameButton>
                                        )
                                    }
                                />
                            );
                        })}
                    </div>
                </section>
            ))}

            <CommunityGames
                games={community}
                busy={busy}
                busyModuleId={room.busyModuleId}
                onHost={room.createRoom}
            />

            {(state.phase === "searching" || state.phase === "matched") && (
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
