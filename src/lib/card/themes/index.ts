import type { CardTheme } from "@/lib/card/types";
import { creatorTheme } from "./creator";
import { freeTheme } from "./free";

export const THEMES: Record<string, CardTheme> = {
  free: freeTheme,
  creator: creatorTheme,
};

export { creatorTheme, freeTheme };
