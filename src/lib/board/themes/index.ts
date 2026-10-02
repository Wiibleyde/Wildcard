import type { BoardTheme } from "@/lib/board/types";
import { creatorBoardTheme } from "./creator";
import { darkWoodTheme } from "./dark_wood";
import { greenFeltTheme } from "./green_felt";
import { midnightTheme } from "./midnight";
import { oceanTheme } from "./ocean";

export const BOARD_THEMES: Record<string, BoardTheme> = {
    green_felt: greenFeltTheme,
    dark_wood: darkWoodTheme,
    ocean: oceanTheme,
    midnight: midnightTheme,
    creator: creatorBoardTheme,
};

// A stale id in `player_customizations` falls back to the green felt.
export function getBoardTheme(id: string | null | undefined): BoardTheme {
    return (id && BOARD_THEMES[id]) || greenFeltTheme;
}
