import { type AnyGameModule, registerGame } from "@/lib/engine/types";
import { bataille } from "./bataille/bataille";
import { batailleTable } from "./bataille/table";
import { president } from "./president/president";
import { presidentTable } from "./president/table";
import type { AnyGameTableConfig } from "./table/types";

/**
 * The game catalog. Every native module is registered here under its `id`; the
 * runner, lobby, and API routes resolve modules through this single map, so
 * adding a game is a one-line change (the ECA studio will register here too).
 */
export const GAMES: Record<string, AnyGameModule> = {
    [bataille.id]: registerGame(bataille),
    [president.id]: registerGame(president),
};

/**
 * Table (card placement) config per game — consumed by the single generic
 * `GameTable` component. A new game ships a config + pure `mapView`, never a
 * dedicated React component.
 */
export const GAME_TABLES: Record<string, AnyGameTableConfig> = {
    [bataille.id]: batailleTable,
    [president.id]: presidentTable,
};

/** Resolve a module by id, or `undefined` for an unknown game. */
export function getGameModule(id: string): AnyGameModule | undefined {
    return GAMES[id];
}

/** Resolve a game's table config, or `undefined` when it has none yet. */
export function getGameTable(id: string): AnyGameTableConfig | undefined {
    return GAME_TABLES[id];
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
