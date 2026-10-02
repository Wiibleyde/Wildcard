import { gameCatalog } from "./index";

/*
 * Presentation source of truth for the catalog: engine facts (name, player
 * range) merged with display metadata, plus "coming soon" games with no
 * module yet. Modules stay UI-agnostic on purpose.
 */

/** Display order of the picker's sections. */
export const GAME_CATEGORIES = [
    { id: "duel", accent: "#ff4b3b" },
    { id: "shedding", accent: "#ffc23d" },
    { id: "trick", accent: "#9b6cf2" },
    { id: "solo", accent: "#38cf78" },
    { id: "party", accent: "#3b8cff" },
] as const;

export type GameCategoryId = (typeof GAME_CATEGORIES)[number]["id"];

interface GameDisplayMeta {
    readonly category: GameCategoryId;
    readonly accent: string;
    readonly suits: string;
    readonly difficulty: 1 | 2 | 3;
    readonly durationMin: number;
    /** Name and player range of a game that ships no module yet. */
    readonly comingSoon?: {
        name: string;
        minPlayers: number;
        maxPlayers: number;
    };
}

/** Key order IS the display order. */
const DISPLAY: Record<string, GameDisplayMeta> = {
    bataille: {
        category: "duel",
        accent: "#ff4b3b",
        suits: "♠ ♥",
        difficulty: 1,
        durationMin: 3,
    },
    president: {
        category: "shedding",
        accent: "#ffc23d",
        suits: "♦ ♣",
        difficulty: 2,
        durationMin: 12,
    },
    tarot: {
        category: "trick",
        accent: "#9b6cf2",
        suits: "♠ ♥ ♦ ♣",
        difficulty: 3,
        durationMin: 20,
    },
    solitaire: {
        category: "solo",
        accent: "#38cf78",
        suits: "♦ ♣",
        difficulty: 2,
        durationMin: 6,
    },
    belote: {
        category: "trick",
        accent: "#ff8a3d",
        suits: "♠ ♦",
        difficulty: 3,
        durationMin: 15,
        comingSoon: { name: "Belote", minPlayers: 4, maxPlayers: 4 },
    },
    kems: {
        category: "party",
        accent: "#3b8cff",
        suits: "♥ ♣",
        difficulty: 1,
        durationMin: 8,
        comingSoon: { name: "Kems", minPlayers: 4, maxPlayers: 4 },
    },
};

export interface PlayGame {
    readonly id: string;
    readonly name: string;
    readonly category: GameCategoryId;
    readonly accent: string;
    readonly suits: string;
    readonly difficulty: 1 | 2 | 3;
    readonly durationMin: number;
    readonly minPlayers: number;
    readonly maxPlayers: number;
    /** A registered module exists. */
    readonly available: boolean;
    /** Can be quick-matched against other humans. */
    readonly matchmaking: boolean;
}

let CACHE: PlayGame[] | null = null;

/** Input-free, so built once and memoised. */
export function buildPlayCatalog(): PlayGame[] {
    if (CACHE) return CACHE;

    const engine = new Map(gameCatalog().map((g) => [g.id, g]));
    CACHE = Object.entries(DISPLAY).map(([id, meta]) => {
        const facts = engine.get(id) ?? meta.comingSoon;
        if (!facts) {
            throw new Error(
                `catalog: "${id}" has neither a module nor a comingSoon entry`,
            );
        }
        const available = engine.has(id);
        return {
            id,
            name: facts.name,
            category: meta.category,
            accent: meta.accent,
            suits: meta.suits,
            difficulty: meta.difficulty,
            durationMin: meta.durationMin,
            minPlayers: facts.minPlayers,
            maxPlayers: facts.maxPlayers,
            available,
            matchmaking: available && facts.maxPlayers > 1,
        };
    });
    return CACHE;
}
