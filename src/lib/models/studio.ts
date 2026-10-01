import type { SupabaseClient } from "@supabase/supabase-js";
import { ecaModuleIdFor, isEcaCoverImagePath, isUuid } from "@/lib/eca/id";
import type { EcaDefinition } from "@/lib/eca/types";
import {
    ECA_DESCRIPTION_MAX,
    ECA_NAME_MAX,
    ECA_NAME_MIN,
    type EcaValidationError,
    validateEcaDefinition,
    validateEcaDefinitionForWrite,
} from "@/lib/eca/validate";
import { ecaImagesBucket, publicStorageUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";
import { usernamesByIds } from "./identities";

type Admin = SupabaseClient<Database>;

/**
 * Studio persistence — CRUD over `eca_games`, the table of creator-authored
 * ECA definitions.
 *
 * Every write revalidates the untrusted definition JSON with
 * {@link validateEcaDefinitionForWrite} before it touches the database (the
 * DB CHECK constraints only guard cheap scalar invariants); reads use the
 * tolerant {@link validateEcaDefinition} so rows saved before a write-time
 * lint existed keep loading. Ownership is enforced here
 * from the authoritative row, never trusted from the request; the RLS
 * policies on `eca_games` are the second line of defense for reads. Rows the
 * requester cannot see (or mutate) come back `not_found`, never `forbidden`,
 * so no endpoint confirms that a foreign draft exists.
 *
 * The `name` and `description` columns are authoritative; every write mirrors
 * them into the stored `definition.meta` (see {@link withMeta}) so the
 * embedded copies can never drift from the columns.
 */

export type StudioErrorCode =
    | "not_found"
    | "invalid_definition"
    | "invalid_input"
    | "limit_reached"
    | "moderation_locked"
    | "db_error";

/** HTTP status for each studio error — keeps the route handlers thin. */
export const STUDIO_ERROR_STATUS: Record<StudioErrorCode, number> = {
    not_found: 404,
    invalid_definition: 422,
    invalid_input: 400,
    limit_reached: 409,
    moderation_locked: 423,
    db_error: 500,
};

/**
 * Request-body cap for studio writes (routes read the body through
 * `readJsonObject`). A maximal definition — 32 rules × 8 conditions/effects,
 * capped ids and literals — serializes well under this.
 */
export const STUDIO_MAX_BODY_BYTES = 64 * 1024;

/** Per-owner cap on studio games. Mirrors the DB trigger (`eca_games_cap`). */
export const MAX_ECA_GAMES_PER_OWNER = 20;

/** Max length of a stored cover-image storage path. Mirrors the DB CHECK. */
export const ECA_IMAGE_PATH_MAX = 2048;

export type EcaGameStatus = "draft" | "published";

/** List projection — everything but the (potentially large) definition. */
export interface EcaGameSummary {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
    /** Cover-image storage path in the public `eca-images` bucket, or null. */
    readonly imageUrl: string | null;
    /** Taken down by an admin — the owner cannot re-publish until restored. */
    readonly moderationLocked: boolean;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface EcaGameRow extends EcaGameSummary {
    readonly definition: EcaDefinition;
}

type Failure = {
    ok: false;
    error: StudioErrorCode;
    /** Field-level validation errors — only set for `invalid_definition`. */
    details?: readonly EcaValidationError[];
    /** Internal detail (DB/driver text) — logged on 5xx, never sent. */
    message?: string;
};
type Result<T> = ({ ok: true } & T) | Failure;

const SUMMARY_COLUMNS =
    "id, owner_id, name, description, status, image_url, moderation_locked, created_at, updated_at";

type SummaryRow = {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    status: EcaGameStatus;
    image_url: string | null;
    moderation_locked: boolean;
    created_at: string;
    updated_at: string;
};

function toSummary(row: SummaryRow): EcaGameSummary {
    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        description: row.description,
        status: row.status,
        imageUrl: row.image_url,
        moderationLocked: row.moderation_locked,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function isValidName(name: unknown): name is string {
    return (
        typeof name === "string" &&
        name.length >= ECA_NAME_MIN &&
        name.length <= ECA_NAME_MAX
    );
}

function isValidDescription(description: unknown): description is string {
    return (
        typeof description === "string" &&
        description.length <= ECA_DESCRIPTION_MAX
    );
}

/**
 * A cover-image patch is either `null` (clear it) or EXACTLY the game's own
 * cover path `${ownerId}/${gameId}.<png|jpg|jpeg|webp|gif>` (see
 * {@link isEcaCoverImagePath}). A prefix check is not enough —
 * `${ownerId}/../victim/x.png` starts with the owner's folder — and an exact
 * match also stops a creator from pointing one game at another's cover.
 */
function isValidImagePath(
    value: unknown,
    ownerId: string,
    gameId: string,
): value is string {
    return (
        typeof value === "string" &&
        value.length <= ECA_IMAGE_PATH_MAX &&
        isEcaCoverImagePath(value, ownerId, gameId)
    );
}

/**
 * Best-effort removal of a game's previous cover object. Only a path in the
 * exact cover format for this owner/game is ever removed (rows written before
 * the exact-path check may hold anything — never delete on their say-so). A
 * storage failure leaves an orphan object, never a failed request.
 */
async function removeCoverObject(
    admin: Admin,
    path: string | null,
    ownerId: string,
    gameId: string,
): Promise<void> {
    if (path === null || !isEcaCoverImagePath(path, ownerId, gameId)) return;
    await admin.storage
        .from(ecaImagesBucket())
        .remove([path])
        .catch(() => undefined);
}

/**
 * The row `name` / `description` columns are the single source of truth for
 * the display metadata — the embedded `definition.meta` is overwritten to
 * mirror them on every write so the two can never drift. A `null` column
 * description drops `meta.description` entirely (the field is optional).
 */
function withMeta(
    definition: EcaDefinition,
    name: string,
    description: string | null,
): EcaDefinition {
    const { description: _dropped, ...meta } = definition.meta;
    return {
        ...definition,
        meta: {
            ...meta,
            name,
            ...(description !== null ? { description } : {}),
        },
    };
}

/** The creator's own games, most recently edited first. */
export async function listEcaGames(
    admin: Admin,
    ownerId: string,
): Promise<Result<{ games: readonly EcaGameSummary[] }>> {
    const { data, error } = await admin
        .from("eca_games")
        .select(SUMMARY_COLUMNS)
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false });
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    return { ok: true, games: data.map(toSummary) };
}

/**
 * One full game (definition included). Readable by its owner in any status,
 * and by anyone once published — the same visibility the RLS select policy
 * grants, re-enforced here because the admin client bypasses RLS.
 */
export async function getEcaGame(
    admin: Admin,
    id: string,
    requesterId: string,
): Promise<Result<{ game: EcaGameRow }>> {
    if (!isUuid(id)) return { ok: false, error: "not_found" };
    const { data, error } = await admin
        .from("eca_games")
        .select(`${SUMMARY_COLUMNS}, definition`)
        .eq("id", id)
        .maybeSingle();
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    if (!data) return { ok: false, error: "not_found" };
    // Rows the requester cannot see under the RLS select policy answer
    // `not_found` (not a distinct `forbidden`) so the endpoint never confirms
    // a draft id exists to an outsider — same convention as replay.ts.
    if (data.owner_id !== requesterId && data.status !== "published") {
        return { ok: false, error: "not_found" };
    }

    // Stored definitions were validated on write; re-narrowing here (instead
    // of casting the jsonb) keeps the invariant checked end to end. Tolerant
    // read: a row saved before a write-time lint existed still loads.
    const validated = validateEcaDefinition(data.definition);
    if (!validated.ok) {
        return {
            ok: false,
            error: "db_error",
            message: "stored definition failed validation",
        };
    }

    return {
        ok: true,
        game: { ...toSummary(data), definition: validated.definition },
    };
}

/**
 * Create a game from an untrusted `{name, description?, definition}` payload.
 * The per-owner cap is enforced by the race-safe DB trigger — its
 * `check_violation` surfaces as `limit_reached`.
 */
export async function createEcaGame(
    admin: Admin,
    ownerId: string,
    input: unknown,
): Promise<Result<{ id: string }>> {
    if (typeof input !== "object" || input === null) {
        return { ok: false, error: "invalid_input" };
    }
    const body = input as {
        name?: unknown;
        description?: unknown;
        definition?: unknown;
    };
    if (!isValidName(body.name)) return { ok: false, error: "invalid_input" };
    let description: string | null = null;
    if (body.description !== undefined && body.description !== null) {
        if (!isValidDescription(body.description)) {
            return { ok: false, error: "invalid_input" };
        }
        description = body.description;
    }

    const validated = validateEcaDefinitionForWrite(body.definition);
    if (!validated.ok) {
        return {
            ok: false,
            error: "invalid_definition",
            details: validated.errors,
        };
    }
    const definition = withMeta(validated.definition, body.name, description);

    const { data, error } = await admin
        .from("eca_games")
        .insert({
            owner_id: ownerId,
            name: body.name,
            description,
            definition: { ...definition },
        })
        .select("id")
        .single();
    if (error) {
        // The cap trigger raises check_violation past the cap.
        return {
            ok: false,
            error: error.code === "23514" ? "limit_reached" : "db_error",
            message: error.message,
        };
    }
    return { ok: true, id: data.id };
}

/**
 * Partial update of an owned game — any subset of name / description /
 * definition / status. Publishing requires the game's effective definition
 * (the patched one, or the stored one otherwise) to validate, so a broken
 * draft can never reach the published catalog. Name and description patches
 * are mirrored into the stored `definition.meta`, which is why they also
 * trigger a revalidation + rewrite of the definition.
 *
 * A game taken down by an admin (`moderation_locked`) stays editable — so
 * the creator can fix it — but publishing it is refused with
 * `moderation_locked` until an admin restores it.
 */
export async function updateEcaGame(
    admin: Admin,
    id: string,
    ownerId: string,
    patch: unknown,
): Promise<{ ok: true } | Failure> {
    if (!isUuid(id)) return { ok: false, error: "not_found" };
    const { data: row, error: fetchError } = await admin
        .from("eca_games")
        .select(
            "owner_id, name, description, definition, status, image_url, moderation_locked",
        )
        .eq("id", id)
        .maybeSingle();
    if (fetchError) {
        return { ok: false, error: "db_error", message: fetchError.message };
    }
    if (!row) return { ok: false, error: "not_found" };
    // Foreign rows answer `not_found` (never `forbidden`) so a mutation can
    // confirm neither a draft's existence nor write access — same convention
    // as replay.ts.
    if (row.owner_id !== ownerId) return { ok: false, error: "not_found" };

    if (typeof patch !== "object" || patch === null) {
        return { ok: false, error: "invalid_input" };
    }
    const body = patch as {
        name?: unknown;
        description?: unknown;
        definition?: unknown;
        status?: unknown;
        image_url?: unknown;
    };
    if (
        body.name === undefined &&
        body.description === undefined &&
        body.definition === undefined &&
        body.status === undefined &&
        body.image_url === undefined
    ) {
        return { ok: false, error: "invalid_input" };
    }

    let namePatch: string | undefined;
    if (body.name !== undefined) {
        if (!isValidName(body.name)) {
            return { ok: false, error: "invalid_input" };
        }
        namePatch = body.name;
    }
    let descriptionPatch: string | null | undefined;
    if (body.description !== undefined) {
        if (
            body.description !== null &&
            !isValidDescription(body.description)
        ) {
            return { ok: false, error: "invalid_input" };
        }
        descriptionPatch = body.description;
    }
    let statusPatch: EcaGameStatus | undefined;
    if (body.status !== undefined) {
        if (body.status !== "draft" && body.status !== "published") {
            return { ok: false, error: "invalid_input" };
        }
        statusPatch = body.status;
    }
    if (statusPatch === "published" && row.moderation_locked) {
        return { ok: false, error: "moderation_locked" };
    }
    let imagePatch: string | null | undefined;
    if (body.image_url !== undefined) {
        if (
            body.image_url !== null &&
            !isValidImagePath(body.image_url, ownerId, id)
        ) {
            return { ok: false, error: "invalid_input" };
        }
        imagePatch = body.image_url;
    }

    const name = namePatch ?? row.name;
    const effectiveDescription =
        descriptionPatch !== undefined ? descriptionPatch : row.description;

    // Effective definition after this patch — needed (and therefore
    // validated) when the patch replaces it, when publishing depends on the
    // stored one, or when a name/description change must be mirrored into
    // `definition.meta`. Nothing invalid is ever (re)written or published.
    let definition: EcaDefinition | null = null;
    if (
        body.definition !== undefined ||
        statusPatch === "published" ||
        name !== row.name ||
        descriptionPatch !== undefined
    ) {
        const validated = validateEcaDefinitionForWrite(
            body.definition !== undefined ? body.definition : row.definition,
        );
        if (!validated.ok) {
            return {
                ok: false,
                error: "invalid_definition",
                details: validated.errors,
            };
        }
        definition = validated.definition;
    }

    const update: Database["wildcard"]["Tables"]["eca_games"]["Update"] = {
        updated_at: new Date().toISOString(),
    };
    if (namePatch !== undefined) update.name = namePatch;
    if (descriptionPatch !== undefined) update.description = descriptionPatch;
    if (statusPatch !== undefined) update.status = statusPatch;
    if (imagePatch !== undefined) update.image_url = imagePatch;
    if (definition !== null) {
        // definition.meta mirrors the row name/description columns (single
        // source of truth) so the stored copies can never drift.
        update.definition = {
            ...withMeta(definition, name, effectiveDescription),
        };
    }

    // Ownership re-asserted ON the write (not only by the read above), so
    // the check and the mutation are one statement.
    const { error } = await admin
        .from("eca_games")
        .update(update)
        .eq("id", id)
        .eq("owner_id", ownerId);
    if (error) {
        // check_violation on a publish = the moderation-lock CHECK: an admin
        // took the game down between our read and this write.
        if (error.code === "23514" && statusPatch === "published") {
            return { ok: false, error: "moderation_locked" };
        }
        return { ok: false, error: "db_error", message: error.message };
    }

    // A new extension (or a cleared cover) leaves the previous object behind
    // — remove it. Same path = upserted in place, nothing to clean.
    if (imagePatch !== undefined && imagePatch !== row.image_url) {
        await removeCoverObject(admin, row.image_url, ownerId, id);
    }
    return { ok: true };
}

/** One published creator game, as the community browse hub needs it. */
export interface PublishedEcaGame {
    readonly id: string;
    /** `eca:<uuid>` — pass straight to room creation. */
    readonly moduleId: string;
    readonly name: string;
    readonly description: string | null;
    /** Display-ready public cover URL, or null. */
    readonly imageUrl: string | null;
    readonly ownerName: string;
    readonly ruleCount: number;
    readonly minPlayers: number;
    readonly maxPlayers: number;
}

/** Cap on the community browse list — newest published first. */
const COMMUNITY_LIMIT = 48;

/**
 * The public catalog of published creator games — what every player can host.
 * Readable through the RLS client (the select policy exposes published rows to
 * any authenticated user), so this needs no service role. Definitions were
 * validated on publish; player range and rule count are read back from the
 * stored `meta`/`rules` for the card, and owner names resolved in one lookup.
 */
export async function listPublishedEcaGames(
    client: Admin,
): Promise<PublishedEcaGame[]> {
    const { data, error } = await client
        .from("eca_games")
        .select(
            "id, name, description, image_url, definition, owner_id, updated_at",
        )
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(COMMUNITY_LIMIT);
    if (error || !data) return [];

    const nameOf = await usernamesByIds(
        client,
        data.map((row) => row.owner_id),
    );

    // The column is jsonb: narrow it (tolerant read) instead of casting. A
    // row that does not even parse could not be launched either
    // (resolveLaunchableModule validates the same way) — leave it out.
    return data.flatMap((row) => {
        const validated = validateEcaDefinition(row.definition);
        if (!validated.ok) return [];
        const def = validated.definition;
        return [
            {
                id: row.id,
                moduleId: ecaModuleIdFor(row.id),
                name: row.name,
                description: row.description,
                imageUrl: row.image_url
                    ? publicStorageUrl(ecaImagesBucket(), row.image_url)
                    : null,
                ownerName: nameOf.get(row.owner_id) ?? "?",
                ruleCount: def.rules.length,
                minPlayers: def.meta.minPlayers,
                maxPlayers: def.meta.maxPlayers,
            },
        ];
    });
}

/** Delete an owned game, and its cover object. */
export async function deleteEcaGame(
    admin: Admin,
    id: string,
    ownerId: string,
): Promise<{ ok: true } | Failure> {
    if (!isUuid(id)) return { ok: false, error: "not_found" };
    const { data: row, error: fetchError } = await admin
        .from("eca_games")
        .select("owner_id, image_url")
        .eq("id", id)
        .maybeSingle();
    if (fetchError) {
        return { ok: false, error: "db_error", message: fetchError.message };
    }
    if (!row) return { ok: false, error: "not_found" };
    // Foreign rows answer `not_found` (never `forbidden`) so a mutation can
    // confirm neither a draft's existence nor write access — same convention
    // as replay.ts.
    if (row.owner_id !== ownerId) return { ok: false, error: "not_found" };

    const { error } = await admin
        .from("eca_games")
        .delete()
        .eq("id", id)
        .eq("owner_id", ownerId);
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    await removeCoverObject(admin, row.image_url, ownerId, id);
    return { ok: true };
}
