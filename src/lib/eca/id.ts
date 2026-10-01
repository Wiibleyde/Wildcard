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

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether `value` is a canonical uuid — studio row ids are checked up front
 * so a malformed id answers `not_found` (404) instead of reaching Postgres
 * and failing the uuid cast as a `db_error` (500).
 */
export function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value);
}

// ── Cover images ─────────────────────────────────────────────────────────────

/** File extensions a cover may have — mirrors the bucket's allowed mime types. */
export const ECA_IMAGE_EXTENSIONS = [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
] as const;
export type EcaImageExtension = (typeof ECA_IMAGE_EXTENSIONS)[number];

/** Normalized extension of an uploaded file name, or `null` if not allowed. */
export function ecaImageExtensionOf(
    fileName: string,
): EcaImageExtension | null {
    const dot = fileName.lastIndexOf(".");
    if (dot === -1) return null;
    const ext = fileName.slice(dot + 1).toLowerCase();
    return (ECA_IMAGE_EXTENSIONS as readonly string[]).includes(ext)
        ? (ext as EcaImageExtension)
        : null;
}

/**
 * The ONE storage path a game's cover may live at: `<ownerId>/<gameId>.<ext>`
 * — inside the owner's own folder (what the storage RLS policy lets them
 * write) and named after the game, so a creator can never point a game at
 * another object (`<uid>/../victim/x.png`, another game's cover…).
 */
export function ecaCoverImagePath(
    ownerId: string,
    gameId: string,
    ext: EcaImageExtension,
): string {
    return `${ownerId}/${gameId}.${ext}`;
}

/** Whether `path` is exactly one of the allowed cover paths for this game. */
export function isEcaCoverImagePath(
    path: string,
    ownerId: string,
    gameId: string,
): boolean {
    return ECA_IMAGE_EXTENSIONS.some(
        (ext) => path === ecaCoverImagePath(ownerId, gameId, ext),
    );
}
