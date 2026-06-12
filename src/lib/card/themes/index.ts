import type { CardTheme } from "@/lib/card/types";
import { creatorTheme } from "./creator";
import { freeTheme } from "./free";

export const THEMES: Record<string, CardTheme> = {
    free: freeTheme,
    creator: creatorTheme,
};

/**
 * Resolve a stored `deck_style_id` to its theme. Unknown or missing ids fall
 * back to the free deck, so a stale id in `player_customizations` can never
 * break a table render.
 */
export function getCardTheme(id: string | null | undefined): CardTheme {
    return (id && THEMES[id]) || freeTheme;
}

export { creatorTheme, freeTheme };
