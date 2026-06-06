import { type AnyGameModule, registerGame } from "@/lib/engine/types";
import { bataille } from "./bataille/bataille";
import { president } from "./president/president";

/**
 * The game catalog. Every native module is registered here under its `id`; the
 * runner, lobby, and API routes resolve modules through this single map, so
 * adding a game is a one-line change (the ECA studio will register here too).
 */
export const GAMES: Record<string, AnyGameModule> = {
    [bataille.id]: registerGame(bataille),
    [president.id]: registerGame(president),
};

/** Resolve a module by id, or `undefined` for an unknown game. */
export function getGameModule(id: string): AnyGameModule | undefined {
    return GAMES[id];
}

/** Lightweight catalog entry for lobby UI (no engine internals leaked). */
export interface GameCatalogEntry {
    readonly id: string;
    readonly name: string;
    readonly minPlayers: number;
    readonly maxPlayers: number;
}

export function gameCatalog(): GameCatalogEntry[] {
    return Object.values(GAMES).map((m) => ({
        id: m.id,
        name: m.name,
        minPlayers: m.minPlayers,
        maxPlayers: m.maxPlayers,
    }));
}
