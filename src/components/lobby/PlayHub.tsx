"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { useMatchmaking } from "@/hooks/lobby/useMatchmaking";
import { useRoomAction } from "@/hooks/lobby/useRoomAction";
import { useApiErrorLabel } from "@/hooks/useApiErrorLabel";
import type { PlayGame } from "@/lib/games/catalog";
import { gameLabels, type Translate } from "@/lib/games/catalogView";
import type { PublishedEcaGame } from "@/lib/models/studio";
import { CommunityGames } from "./CommunityGames";
import { GameFan } from "./GameFan";
import { JoinRoomPanel } from "./JoinRoomPanel";
import { MatchmakingOverlay } from "./MatchmakingOverlay";

interface Props {
    readonly userId: string;
    readonly games: PlayGame[];
    readonly community: readonly PublishedEcaGame[];
}

/** Game the fan opens on: the multiplayer flagship. */
const DEFAULT_GAME = "president";

export function PlayHub({ userId, games, community }: Props) {
    const t = useTranslations("lobby");
    const errorLabel = useApiErrorLabel();
    // catalogView builds its keys dynamically (`cat_${id}`) and takes a loose translator.
    const tg = useTranslations("games") as unknown as Translate;
    const { state, quickMatch, cancel, playBots } = useMatchmaking(userId);
    // One room action for the whole page: a single busy state and error banner.
    const room = useRoomAction();

    const playable = games.filter((g) => g.available);
    const [selectedId, setSelectedId] = useState(
        () =>
            playable.find((g) => g.id === DEFAULT_GAME)?.id ??
            playable[0]?.id ??
            null,
    );
    const selected = playable.find((g) => g.id === selectedId);
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
            <section className="flex flex-col gap-3">
                <GameFan
                    games={games}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                />
                {selected && (
                    <>
                        <div className="flex flex-wrap justify-center gap-3">
                            {selected.matchmaking ? (
                                <>
                                    <GameButton
                                        variant="orange"
                                        size="lg"
                                        onClick={() => quickMatch(selected.id)}
                                        disabled={busy}
                                    >
                                        {t("quick_match")}
                                        <small className="text-sm opacity-90">
                                            {selected.name}
                                        </small>
                                    </GameButton>
                                    <GameButton
                                        variant="teal"
                                        size="lg"
                                        onClick={() =>
                                            room.createRoom(selected.id)
                                        }
                                        disabled={busy}
                                    >
                                        {createLabel(
                                            selected.id,
                                            t("create_private"),
                                        )}
                                    </GameButton>
                                    <GameButton
                                        variant="green"
                                        size="lg"
                                        onClick={() => playBots(selected.id)}
                                        disabled={busy}
                                    >
                                        {t("play_bots_short")}
                                    </GameButton>
                                </>
                            ) : (
                                <GameButton
                                    variant="orange"
                                    size="lg"
                                    onClick={() => room.createRoom(selected.id)}
                                    disabled={busy}
                                >
                                    {createLabel(selected.id, t("play_solo"))}
                                    <small className="text-sm opacity-90">
                                        {selected.name}
                                    </small>
                                </GameButton>
                            )}
                        </div>
                        <SelectedMeta game={selected} tg={tg} />
                    </>
                )}
            </section>

            {errorText && <ErrorBanner>{errorText}</ErrorBanner>}

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
                <JoinRoomPanel
                    busy={busy}
                    joining={room.busy?.action === "join"}
                    onJoin={room.joinRoom}
                />
                <CommunityGames
                    games={community}
                    busy={busy}
                    busyModuleId={room.busyModuleId}
                    onHost={room.createRoom}
                />
            </div>

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

function SelectedMeta({ game, tg }: { game: PlayGame; tg: Translate }) {
    const { categoryLabel, meta } = gameLabels(game, tg);
    return (
        <p className="text-center text-sm font-semibold text-wc-muted">
            <span style={{ color: game.accent }}>{categoryLabel}</span>
            {" · "}
            {meta.players}
            {" · "}
            {meta.duration}
            {" · "}
            <b className="text-wc-gold">{meta.difficulty}</b>
        </p>
    );
}
