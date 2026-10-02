/**
 * Studio module ids are `eca:<eca_games uuid>` (native ones are bare slugs).
 * Pure, so client components can use it too.
 */

const ECA_MODULE_PREFIX = "eca:";

/** Includes the `eca:draft` sandbox. */
export function isEcaModuleId(id: string): boolean {
    return id.startsWith(ECA_MODULE_PREFIX);
}

export function ecaGameIdFromModuleId(moduleId: string): string {
    return moduleId.slice(ECA_MODULE_PREFIX.length);
}

export function ecaModuleIdFor(gameId: string): string {
    return `${ECA_MODULE_PREFIX}${gameId}`;
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checked up front so a malformed id is a 404, not a Postgres uuid-cast 500. */
export function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value);
}

/** Mirrors the bucket's allowed mime types. */
export const ECA_IMAGE_EXTENSIONS = [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
] as const;
type EcaImageExtension = (typeof ECA_IMAGE_EXTENSIONS)[number];

export function ecaImageExtensionOf(
    fileName: string,
): EcaImageExtension | null {
    const dot = fileName.lastIndexOf(".");
    if (dot === -1) return null;
    const ext = fileName.slice(dot + 1).toLowerCase();
    return ECA_IMAGE_EXTENSIONS.find((allowed) => allowed === ext) ?? null;
}

/**
 * The only path a cover may live at: inside the owner's folder (storage RLS)
 * and named after the game, so it can never point at another object.
 */
export function ecaCoverImagePath(
    ownerId: string,
    gameId: string,
    ext: EcaImageExtension,
): string {
    return `${ownerId}/${gameId}.${ext}`;
}

export function isEcaCoverImagePath(
    path: string,
    ownerId: string,
    gameId: string,
): boolean {
    return ECA_IMAGE_EXTENSIONS.some(
        (ext) => path === ecaCoverImagePath(ownerId, gameId, ext),
    );
}
