"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { useThemeSelection } from "@/hooks/useThemeSelection";
import { BOARD_THEMES } from "@/lib/board/themes";
import type { BoardTheme } from "@/lib/board/types";
import { THEMES } from "@/lib/card/themes";
import type { CardTheme } from "@/lib/card/types";
import { BoardTile } from "./BoardTile";
import { DeckTile } from "./DeckTile";
import { ThemeSection } from "./ThemeSection";
import { TileShell } from "./TileShell";

type Props = {
    ownedDeckStyleIds: string[];
    ownedBoardStyleIds: string[];
    currentDeckStyleId: string;
    currentBoardStyleId: string;
};

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

export function CustomizeView({
    ownedDeckStyleIds,
    ownedBoardStyleIds,
    currentDeckStyleId,
    currentBoardStyleId,
}: Props) {
    const t = useTranslations("customize");
    const tThemes = useTranslations("themes");

    const deck = useThemeSelection("deck_style_id", currentDeckStyleId);
    const board = useThemeSelection("board_style_id", currentBoardStyleId);

    const ownedDeckThemes: CardTheme[] = ownedDeckStyleIds
        .map((id) => THEMES[id])
        .filter(isDefined);
    const ownedBoardThemes: BoardTheme[] = ownedBoardStyleIds
        .map((id) => BOARD_THEMES[id])
        .filter(isDefined);

    // Theme ids live in the theme registries, so the message key is dynamic;
    // an id without a translation falls back to the raw id.
    function themeName(kind: "deck" | "board", id: string): string {
        const key = `${kind}.${id}` as Parameters<typeof tThemes.has>[0];
        return tThemes.has(key) ? tThemes(key) : id;
    }

    return (
        <PageShell width="wide" className="flex flex-col gap-5">
            <PageHeader title={t("title")} subtitle={t("subtitle")} />

            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2">
                <ThemeSection
                    glyph="♠"
                    label={t("deck_section")}
                    status={deck.mutation.status}
                >
                    {ownedDeckThemes.map((theme) => (
                        <TileShell
                            key={theme.id}
                            name={themeName("deck", theme.id)}
                            tier={theme.tier}
                            selected={theme.id === deck.activeId}
                            onClick={() => deck.select(theme.id)}
                            previewHref={`/customize/preview?deck=${theme.id}&board=${board.activeId}`}
                        >
                            <DeckTile theme={theme} />
                        </TileShell>
                    ))}
                </ThemeSection>

                <ThemeSection
                    glyph="♣"
                    label={t("board_section")}
                    status={board.mutation.status}
                >
                    {ownedBoardThemes.map((theme) => (
                        <TileShell
                            key={theme.id}
                            name={themeName("board", theme.id)}
                            tier={theme.tier}
                            selected={theme.id === board.activeId}
                            onClick={() => board.select(theme.id)}
                            previewHref={`/customize/preview?deck=${deck.activeId}&board=${theme.id}`}
                        >
                            <BoardTile theme={theme} />
                        </TileShell>
                    ))}
                </ThemeSection>
            </div>
        </PageShell>
    );
}
