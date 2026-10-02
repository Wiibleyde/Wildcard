import type { CardTheme } from "@/lib/card/types";
import { creatorTheme } from "./creator";
import { freeTheme } from "./free";

export const THEMES: Record<string, CardTheme> = {
    free: freeTheme,
    creator: creatorTheme,
};

// A stale id in `player_customizations` falls back to the free deck.
export function getCardTheme(id: string | null | undefined): CardTheme {
    return (id && THEMES[id]) || freeTheme;
}
