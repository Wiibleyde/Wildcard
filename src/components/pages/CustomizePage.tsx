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
        <div className="min-h-screen bg-wc-surface px-4 xl:px-10 pt-6 md:pt-10 pb-10">
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-4">
                <div
                    className="rounded-wc-card p-6 border"
                    style={{
                        background:
                            "linear-gradient(160deg, #1d1a0e, #0c1118 72%)",
                        borderColor: "rgba(232,196,104,0.22)",
                    }}
                >
                    <h1 className="text-(length:--font-size-wc-label) font-bold text-wc-sub uppercase tracking-(--letter-spacing-wc-cap)">
                        {t("title")}
                    </h1>
                </div>

                <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start flex flex-col gap-4 lg:flex-none">
                    <div className="bg-wc-panel rounded-wc-panel p-6 border border-wc-border">
                        <h2 className="text-sm font-bold text-wc-muted mb-4 uppercase tracking-(--letter-spacing-wc-cap) flex items-center gap-2">
                            {t("deck_section")}
                            {deckMutation.status === "pending" && (
                                <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent border-wc-muted animate-spin" />
                            )}
                            {deckMutation.status === "error" && (
                                <span className="text-red-400 text-xs font-semibold normal-case tracking-normal">
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

                    <div className="bg-wc-panel rounded-wc-panel p-6 border border-wc-border">
                        <h2 className="text-sm font-bold text-wc-muted mb-4 uppercase tracking-(--letter-spacing-wc-cap) flex items-center gap-2">
                            {t("board_section")}
                            {boardMutation.status === "pending" && (
                                <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent border-wc-muted animate-spin" />
                            )}
                            {boardMutation.status === "error" && (
                                <span className="text-red-400 text-xs font-semibold normal-case tracking-normal">
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
