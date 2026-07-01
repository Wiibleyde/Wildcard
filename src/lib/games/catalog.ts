import { gameCatalog } from "./index";

/**
 * Display layer for the game catalog. The engine `GameModule` is a pure game
 * contract — it deliberately knows nothing about UI (colours, categories,
 * taglines). This module is the *presentation* source of truth: it merges the
 * engine facts (name, player range) for every registered game with the display
 * metadata below, and adds "coming soon" games that have no module yet.
 *
 * Home page and the play-hub picker both read from here, so the catalog is
 * described once and never drifts between the two surfaces.
 */

/** Buckets the picker groups games into. Order here is the display order. */
export const GAME_CATEGORIES = [
    { id: "duel", accent: "#e04040" },
    { id: "shedding", accent: "#f5c516" },
    { id: "trick", accent: "#26ccba" },
    { id: "solo", accent: "#48c97a" },
    { id: "party", accent: "#38bdf8" },
] as const;

export type GameCategoryId = (typeof GAME_CATEGORIES)[number]["id"];

/** Display-only metadata, keyed by game id (engine id, or a placeholder id). */
interface GameDisplayMeta {
    readonly category: GameCategoryId;
    readonly accent: string;
    readonly shadow: string;
    readonly suits: string;
    /** 1 = easy, 2 = medium, 3 = hard. Drives the difficulty pips. */
    readonly difficulty: 1 | 2 | 3;
    /** Typical game length in minutes — shown as "~N min". */
    readonly durationMin: number;
    /** Player range + name for games that ship no engine module yet. */
    readonly comingSoon?: {
        name: string;
        minPlayers: number;
        maxPlayers: number;
    };
}

const DISPLAY: Record<string, GameDisplayMeta> = {
    bataille: {
        category: "duel",
        accent: "#e04040",
        shadow: "#8a1010",
        suits: "♠ ♥",
        difficulty: 1,
        durationMin: 3,
    },
    president: {
        category: "shedding",
        accent: "#f5c516",
        shadow: "#8a6800",
        suits: "♦ ♣",
        difficulty: 2,
        durationMin: 12,
    },
    tarot: {
        category: "trick",
        accent: "#26ccba",
        shadow: "#0c5f56",
        suits: "♠ ♥ ♦ ♣",
        difficulty: 3,
        durationMin: 20,
    },
    solitaire: {
        category: "solo",
        accent: "#48c97a",
        shadow: "#1a6038",
        suits: "♦ ♣",
        difficulty: 2,
        durationMin: 6,
    },
    belote: {
        category: "trick",
        accent: "#ff9d3c",
        shadow: "#9a4a00",
        suits: "♠ ♦",
        difficulty: 3,
        durationMin: 15,
        comingSoon: { name: "Belote", minPlayers: 4, maxPlayers: 4 },
    },
    kems: {
        category: "party",
        accent: "#38bdf8",
        shadow: "#0e5a7a",
        suits: "♥ ♣",
        difficulty: 1,
        durationMin: 8,
        comingSoon: { name: "Kems", minPlayers: 4, maxPlayers: 4 },
    },
};

/**
 * One game as the play UI needs it: engine facts when available, display meta
 * always. `available` games have a registered module and can be played now.
 */
export interface PlayGame {
    readonly id: string;
    readonly name: string;
    readonly category: GameCategoryId;
    readonly accent: string;
    readonly shadow: string;
    readonly suits: string;
    readonly difficulty: 1 | 2 | 3;
    readonly durationMin: number;
    readonly minPlayers: number;
    readonly maxPlayers: number;
    readonly available: boolean;
    /** True when the game can be quick-matched against other humans (max > 1). */
    readonly matchmaking: boolean;
}

let CACHE: PlayGame[] | null = null;

/**
 * The merged, serialisable play catalog (server-side; passed to client
 * components). Engine games override the placeholder name/range; coming-soon
 * games fall back to their declared `comingSoon` block.
 *
 * `DISPLAY`'s key order IS the display order (available first, then coming
 * soon) — it's the single list of every game shown, so there's no separate
 * order array to keep in sync. The result is input-free, so it's built once and
 * memoised for every page render.
 */
export function buildPlayCatalog(): PlayGame[] {
    if (CACHE) return CACHE;

    const engine = new Map(gameCatalog().map((g) => [g.id, g]));
    CACHE = Object.entries(DISPLAY).map(([id, meta]) => {
        const mod = engine.get(id);
        const available = mod !== undefined;
        const min = mod?.minPlayers ?? meta.comingSoon?.minPlayers ?? 2;
        const max = mod?.maxPlayers ?? meta.comingSoon?.maxPlayers ?? 4;
        return {
            id,
            name: mod?.name ?? meta.comingSoon?.name ?? id,
            category: meta.category,
            accent: meta.accent,
            shadow: meta.shadow,
            suits: meta.suits,
            difficulty: meta.difficulty,
            durationMin: meta.durationMin,
            minPlayers: min,
            maxPlayers: max,
            available,
            matchmaking: available && max > 1,
        };
    });
    return CACHE;
}
