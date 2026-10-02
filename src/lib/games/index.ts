import { isEcaModuleId } from "@/lib/eca/id";
import { type AnyGameModule, registerGame } from "@/lib/engine/types";
import { bataille } from "./bataille/bataille";
import { batailleTable } from "./bataille/table";
import { ecaTable } from "./eca/table";
import { president } from "./president/president";
import { presidentTable } from "./president/table";
import { solitaire } from "./solitaire/solitaire";
import { solitaireTable } from "./solitaire/table";
import type { AnyGameTableConfig } from "./table/types";
import { tarotTable } from "./tarot/table";
import { tarot } from "./tarot/tarot";

interface RegisteredGame {
    readonly module: AnyGameModule;
    readonly table: AnyGameTableConfig;
}

/** Native games, keyed by module id — a new game is one entry. Studio games resolve in `resolve.ts`. */
const REGISTRY: Readonly<Record<string, RegisteredGame>> = {
    [bataille.id]: {
        module: registerGame(bataille),
        table: batailleTable,
    },
    [president.id]: {
        module: registerGame(president),
        table: presidentTable,
    },
    [solitaire.id]: {
        module: registerGame(solitaire),
        table: solitaireTable,
    },
    [tarot.id]: {
        module: registerGame(tarot),
        table: tarotTable,
    },
};

export const GAMES: Readonly<Record<string, AnyGameModule>> =
    Object.fromEntries(
        Object.entries(REGISTRY).map(([id, game]) => [id, game.module]),
    );

function lookup(id: string): RegisteredGame | undefined {
    return Object.hasOwn(REGISTRY, id) ? REGISTRY[id] : undefined;
}

export function getGameModule(id: string): AnyGameModule | undefined {
    return lookup(id)?.module;
}

/** Every studio game (`eca:<uuid>`) shares the one generic ECA table. */
export function getGameTable(id: string): AnyGameTableConfig | undefined {
    if (isEcaModuleId(id)) return ecaTable;
    return lookup(id)?.table;
}

interface GameCatalogEntry {
    readonly id: string;
    readonly name: string;
    readonly minPlayers: number;
    readonly maxPlayers: number;
}

export function gameCatalog(): GameCatalogEntry[] {
    return Object.values(REGISTRY).map(({ module: m }) => ({
        id: m.id,
        name: m.name,
        minPlayers: m.minPlayers,
        maxPlayers: m.maxPlayers,
    }));
}
