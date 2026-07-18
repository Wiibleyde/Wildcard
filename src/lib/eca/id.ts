/**
 * Module-id convention for studio (ECA) games.
 *
 * A native game's module id is a bare slug (`"bataille"`); a studio game's is
 * its `eca_games` row uuid behind an `eca:` prefix (`"eca:<uuid>"`). The prefix
 * is what lets every id-keyed surface — the runner's module resolver, the table
 * catalog, the rooms/games rows — tell "this is a creator game, resolve it from
 * the database" apart from "this is a native module in the static registry",
 * with no separate flag column.
 *
 * These helpers are PURE (no imports, no I/O) so they are safe to use from
 * client components (e.g. the table catalog) as well as the server.
 */

/** The prefix every studio-game module id carries. */
export const ECA_MODULE_PREFIX = "eca:";

/** True for a studio (ECA) module id — `eca:<uuid>` (incl. the `eca:draft` sandbox). */
export function isEcaModuleId(id: string): boolean {
    return id.startsWith(ECA_MODULE_PREFIX);
}

/** The `eca_games` row id embedded in an `eca:<uuid>` module id. */
export function ecaGameIdFromModuleId(moduleId: string): string {
    return moduleId.slice(ECA_MODULE_PREFIX.length);
}

/** The module id (`eca:<uuid>`) for a stored studio game. */
export function ecaModuleIdFor(gameId: string): string {
    return `${ECA_MODULE_PREFIX}${gameId}`;
}
