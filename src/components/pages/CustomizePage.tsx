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
        <div
            className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-5">
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
                        {t("subtitle")}
                    </p>
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
