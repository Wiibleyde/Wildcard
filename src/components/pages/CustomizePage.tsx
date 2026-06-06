"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BoardTile } from "@/components/customize/BoardTile";
import { DeckTile } from "@/components/customize/DeckTile";
import { useApiMutation } from "@/hooks/useApiMutation";
import { BOARD_THEMES } from "@/lib/board/themes";
import type { BoardTheme } from "@/lib/board/types";
import { THEMES } from "@/lib/card/themes";
import type { CardTheme } from "@/lib/card/types";
import type { CustomizationPatch } from "@/lib/models/customization";

type Props = {
    ownedDeckStyleIds: string[];
    ownedBoardStyleIds: string[];
    currentDeckStyleId: string;
    currentBoardStyleId: string;
};

export function CustomizePage({
    ownedDeckStyleIds,
    ownedBoardStyleIds,
    currentDeckStyleId,
    currentBoardStyleId,
}: Props) {
    "use no memo";
    const t = useTranslations("customize");
    const tCommon = useTranslations("common");

    const [activeDeck, setActiveDeck] = useState(currentDeckStyleId);
    const [activeBoard, setActiveBoard] = useState(currentBoardStyleId);

    const deckMutation =
        useApiMutation<CustomizationPatch>("/api/customization");
    const boardMutation =
        useApiMutation<CustomizationPatch>("/api/customization");

    const ownedDeckThemes = ownedDeckStyleIds
        .map((id) => THEMES[id])
        .filter(Boolean) as CardTheme[];

    const ownedBoardThemes = ownedBoardStyleIds
        .map((id) => BOARD_THEMES[id])
        .filter(Boolean) as BoardTheme[];

    async function selectDeck(id: string) {
        if (id === activeDeck || deckMutation.status === "pending") return;
        const prev = activeDeck;
        setActiveDeck(id);
        const ok = await deckMutation.mutate({ deck_style_id: id });
        if (!ok) setActiveDeck(prev);
    }

    async function selectBoard(id: string) {
        if (id === activeBoard || boardMutation.status === "pending") return;
        const prev = activeBoard;
        setActiveBoard(id);
        const ok = await boardMutation.mutate({ board_style_id: id });
        if (!ok) setActiveBoard(prev);
    }

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-5">
                {/* Header */}
                <div
                    className="rounded-2xl px-6 py-5"
                    style={{
                        background:
                            "linear-gradient(150deg, #211708 0%, #0d0a05 70%)",
                        border: "2px solid rgba(245,197,22,0.18)",
                    }}
                >
                    <h1
                        className="text-2xl xl:text-3xl font-black tracking-tight"
                        style={{ color: "#faf2e2" }}
                    >
                        ♦ {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold mt-1"
                        style={{ color: "#7a6a50" }}
                    >
                        Personnalise ton style de jeu
                    </p>
                </div>

                <div className="lg:grid lg:grid-cols-2 lg:gap-5 flex flex-col gap-5 lg:flex-none">
                    {/* Deck section */}
                    <div
                        className="rounded-xl p-6 border"
                        style={{
                            background: "#1c1510",
                            borderColor: "#3d2d18",
                        }}
                    >
                        <h2
                            className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
                            style={{ color: "#7a6a50" }}
                        >
                            ♠ {t("deck_section")}
                            {deckMutation.status === "pending" && (
                                <span
                                    className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                                    style={{ borderColor: "#f5c516" }}
                                />
                            )}
                            {deckMutation.status === "error" && (
                                <span
                                    className="text-xs font-bold normal-case tracking-normal"
                                    style={{ color: "#e04040" }}
                                >
                                    {tCommon("error")}
                                </span>
                            )}
                        </h2>
                        <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                            {ownedDeckThemes.map((theme) => (
                                <DeckTile
                                    key={theme.id}
                                    theme={theme}
                                    selected={theme.id === activeDeck}
                                    onClick={() => selectDeck(theme.id)}
                                    previewHref={`/customize/preview?deck=${theme.id}&board=${activeBoard}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Board section */}
                    <div
                        className="rounded-xl p-6 border"
                        style={{
                            background: "#1c1510",
                            borderColor: "#3d2d18",
                        }}
                    >
                        <h2
                            className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
                            style={{ color: "#7a6a50" }}
                        >
                            ♣ {t("board_section")}
                            {boardMutation.status === "pending" && (
                                <span
                                    className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                                    style={{ borderColor: "#f5c516" }}
                                />
                            )}
                            {boardMutation.status === "error" && (
                                <span
                                    className="text-xs font-bold normal-case tracking-normal"
                                    style={{ color: "#e04040" }}
                                >
                                    {tCommon("error")}
                                </span>
                            )}
                        </h2>
                        <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                            {ownedBoardThemes.map((theme) => (
                                <BoardTile
                                    key={theme.id}
                                    theme={theme}
                                    selected={theme.id === activeBoard}
                                    onClick={() => selectBoard(theme.id)}
                                    previewHref={`/customize/preview?deck=${activeDeck}&board=${theme.id}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
