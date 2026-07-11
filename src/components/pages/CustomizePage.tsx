"use client";

import { useTranslations } from "next-intl";
import { BoardTile } from "@/components/customize/BoardTile";
import { DeckTile } from "@/components/customize/DeckTile";
import { ThemeSection } from "@/components/customize/ThemeSection";
import { useThemeSelection } from "@/hooks/useThemeSelection";
import { BOARD_THEMES } from "@/lib/board/themes";
import type { BoardTheme } from "@/lib/board/types";
import { THEMES } from "@/lib/card/themes";
import type { CardTheme } from "@/lib/card/types";

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

    const deck = useThemeSelection("deck_style_id", currentDeckStyleId);
    const board = useThemeSelection("board_style_id", currentBoardStyleId);

    const ownedDeckThemes = ownedDeckStyleIds
        .map((id) => THEMES[id])
        .filter(Boolean) as CardTheme[];

    const ownedBoardThemes = ownedBoardStyleIds
        .map((id) => BOARD_THEMES[id])
        .filter(Boolean) as BoardTheme[];

    return (
        <div className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16">
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-5">
                <div className="panel-d px-6 py-5">
                    <h1 className="text-2xl xl:text-3xl font-display flex items-center gap-2 text-wc-cream">
                        <span style={{ color: "var(--red)" }}>♦</span>{" "}
                        {t("title")}
                    </h1>
                    <p className="sub text-sm mt-1">{t("subtitle")}</p>
                </div>

                <div className="lg:grid lg:grid-cols-2 lg:gap-5 flex flex-col gap-5 lg:flex-none">
                    <ThemeSection
                        glyph="♠"
                        label={t("deck_section")}
                        status={deck.mutation.status}
                    >
                        {ownedDeckThemes.map((theme) => (
                            <DeckTile
                                key={theme.id}
                                theme={theme}
                                selected={theme.id === deck.activeId}
                                onClick={() => deck.select(theme.id)}
                                previewHref={`/customize/preview?deck=${theme.id}&board=${board.activeId}`}
                            />
                        ))}
                    </ThemeSection>

                    <ThemeSection
                        glyph="♣"
                        label={t("board_section")}
                        status={board.mutation.status}
                    >
                        {ownedBoardThemes.map((theme) => (
                            <BoardTile
                                key={theme.id}
                                theme={theme}
                                selected={theme.id === board.activeId}
                                onClick={() => board.select(theme.id)}
                                previewHref={`/customize/preview?deck=${deck.activeId}&board=${theme.id}`}
                            />
                        ))}
                    </ThemeSection>
                </div>
            </div>
        </div>
    );
}
