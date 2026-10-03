import type { PlayGame } from "./catalog";
import type { Translate } from "./table/types";

/*
 * Translated labels for the play catalog — shared by the home
 * showcase and the play hub so wording never drifts between them.
 */

export type { Translate };

/** Index 0 unused: difficulty starts at 1. */
const DIFFICULTY_KEY = [
    "",
    "difficulty_easy",
    "difficulty_medium",
    "difficulty_hard",
] as const;

interface GameMeta {
    readonly players: string;
    readonly duration: string;
    readonly difficulty: string;
    readonly comingSoon: string;
}

interface GameLabels {
    readonly categoryLabel: string;
    readonly description: string;
    readonly meta: GameMeta;
}

export function gameLabels(g: PlayGame, tg: Translate): GameLabels {
    const players =
        g.maxPlayers === 1
            ? tg("players_solo")
            : g.minPlayers === g.maxPlayers
              ? tg("players_exact", { n: g.minPlayers })
              : tg("players_range", { min: g.minPlayers, max: g.maxPlayers });
    return {
        categoryLabel: tg(`cat_${g.category}`),
        description: tg(`desc_${g.id}`),
        meta: {
            players,
            duration: tg("duration", { min: g.durationMin }),
            difficulty: tg(DIFFICULTY_KEY[g.difficulty]),
            comingSoon: tg("coming_soon"),
        },
    };
}
