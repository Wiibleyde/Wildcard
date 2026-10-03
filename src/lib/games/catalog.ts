import type { CardDescriptor } from "@/lib/card/types";
import { gameCatalog } from "./index";

/*
 * Presentation source of truth for the catalog: engine facts (name, player
 * range) merged with display metadata, plus "coming soon" games with no
 * module yet. Modules stay UI-agnostic on purpose.
 */

export const GAME_CATEGORY_IDS = [
    "duel",
    "shedding",
    "trick",
    "solo",
    "party",
] as const;

export type GameCategoryId = (typeof GAME_CATEGORY_IDS)[number];

interface GameDisplayMeta {
    readonly category: GameCategoryId;
    readonly accent: string;
    readonly suits: string;
    /** The card that stands for the game in the lobby fan. */
    readonly signature: CardDescriptor;
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
        accent: "#f4504a",
        suits: "♠ ♥",
        signature: { type: "suited", suit: "spades", rank: "A" },
        difficulty: 1,
        durationMin: 3,
    },
    president: {
        category: "shedding",
        accent: "#f5c64f",
        suits: "♦ ♣",
        signature: { type: "suited", suit: "hearts", rank: "2" },
        difficulty: 2,
        durationMin: 12,
    },
    tarot: {
        category: "trick",
        accent: "#9a6bff",
        suits: "♠ ♥ ♦ ♣",
        signature: { type: "trump", index: 21 },
        difficulty: 3,
        durationMin: 20,
    },
    solitaire: {
        category: "solo",
        accent: "#36b981",
        suits: "♦ ♣",
        signature: { type: "suited", suit: "diamonds", rank: "K" },
        difficulty: 2,
        durationMin: 6,
    },
    belote: {
        category: "trick",
        accent: "#ff9c1f",
        suits: "♠ ♦",
        signature: { type: "suited", suit: "clubs", rank: "J" },
        difficulty: 3,
        durationMin: 15,
        comingSoon: { name: "Belote", minPlayers: 4, maxPlayers: 4 },
    },
    kems: {
        category: "party",
        accent: "#2b8fff",
        suits: "♥ ♣",
        signature: { type: "suited", suit: "hearts", rank: "K" },
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
    readonly signature: CardDescriptor;
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
            signature: meta.signature,
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
