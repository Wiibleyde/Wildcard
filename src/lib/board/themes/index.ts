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

export {
  creatorBoardTheme,
  darkWoodTheme,
  greenFeltTheme,
  midnightTheme,
  oceanTheme,
};
