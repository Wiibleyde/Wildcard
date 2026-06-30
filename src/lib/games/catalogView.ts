import { GAME_CATEGORIES, type GameCategoryId, type PlayGame } from "./catalog";

/**
 * Presentation binding for the play catalog — the single place a {@link PlayGame}
 * is turned into translated labels and grouped into sections. The home showcase
 * and the play hub both render from here, so the wording, the player-count
 * formatting and the difficulty mapping never drift between the two surfaces.
 */

/**
 * Minimal translator shape both `getTranslations` (server) and `useTranslations`
 * (client) satisfy. next-intl types message keys as a strict union; this layer
 * builds keys dynamically (`cat_${id}`, `desc_${id}`), so it takes the looser
 * `string` form and each caller adapts its `tg` once — keeping the unavoidable
 * computed-key cast in a single spot per surface instead of scattered inline.
 */
export type Translate = (
    key: string,
    values?: Record<string, string | number>,
) => string;

/** difficulty (1–3) → dictionary key. Index 0 is unused (difficulty starts at 1). */
const DIFFICULTY_KEY = [
    "",
    "difficulty_easy",
    "difficulty_medium",
    "difficulty_hard",
] as const;

export interface GameMeta {
    readonly players: string;
    readonly duration: string;
    readonly difficulty: string;
    readonly comingSoon: string;
}

export interface GameLabels {
    readonly categoryLabel: string;
    readonly description: string;
    readonly meta: GameMeta;
}

/** Translate one game's display labels (category, description, meta chips). */
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

export interface PlaySection {
    readonly id: GameCategoryId;
    readonly accent: string;
    readonly label: string;
    readonly games: PlayGame[];
}

/** Group games into the display categories, dropping any that end up empty. */
export function buildPlaySections(
    games: PlayGame[],
    tg: Translate,
): PlaySection[] {
    return GAME_CATEGORIES.map((cat) => ({
        id: cat.id,
        accent: cat.accent,
        label: tg(`cat_${cat.id}`),
        games: games.filter((g) => g.category === cat.id),
    })).filter((s) => s.games.length > 0);
}
