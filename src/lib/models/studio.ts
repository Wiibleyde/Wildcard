import { ecaModuleIdFor, isEcaCoverImagePath, isUuid } from "@/lib/eca/id";
import { isRecord } from "@/lib/eca/schema";
import type { EcaDefinition } from "@/lib/eca/types";
import {
    ECA_DESCRIPTION_MAX,
    ECA_NAME_MAX,
    ECA_NAME_MIN,
    type EcaValidationError,
    validateEcaDefinition,
    validateEcaDefinitionForWrite,
} from "@/lib/eca/validate";
import type { AdminClient } from "@/lib/supabase/admin";
import { CHECK_VIOLATION } from "@/lib/supabase/pgErrors";
import { ecaImagesBucket, publicStorageUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";
import { usernamesByIds } from "./identities";

/**
 * CRUD over `eca_games`. Writes run the write-time validator, reads the
 * tolerant one. Ownership is checked against the stored row (the admin client
 * bypasses RLS), and rows the requester may not see answer `not_found`, never
 * `forbidden`, so no endpoint confirms a foreign draft exists. The `name` /
 * `description` columns are authoritative and mirrored into `definition.meta`.
 */

export type StudioErrorCode =
    | "not_found"
    | "invalid_definition"
    | "invalid_input"
    | "limit_reached"
    | "moderation_locked"
    | "db_error";

export const STUDIO_ERROR_STATUS: Record<StudioErrorCode, number> = {
    not_found: 404,
    invalid_definition: 422,
    invalid_input: 400,
    limit_reached: 409,
    moderation_locked: 423,
    db_error: 500,
};

/** A maximal definition serializes well under this. */
export const STUDIO_MAX_BODY_BYTES = 64 * 1024;

/** Mirrors the DB trigger `eca_games_cap`. */
export const MAX_ECA_GAMES_PER_OWNER = 20;

/** Mirrors the DB CHECK. */
const ECA_IMAGE_PATH_MAX = 2048;

export type EcaGameStatus = "draft" | "published";

interface EcaGameSummary {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
    /** Storage path in the public `eca-images` bucket. */
    readonly imageUrl: string | null;
    readonly moderationLocked: boolean;
    readonly ruleCount: number;
    readonly createdAt: string;
    readonly updatedAt: string;
}

interface EcaGameRow extends Omit<EcaGameSummary, "ruleCount"> {
    readonly definition: EcaDefinition;
}

type Failure = {
    ok: false;
    error: StudioErrorCode;
    /** Only for `invalid_definition`. */
    details?: readonly EcaValidationError[];
    /** Logged on 5xx, never sent. */
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

function toSummary(row: SummaryRow): Omit<EcaGameSummary, "ruleCount"> {
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

function parseName(name: unknown): string | null {
    if (typeof name !== "string") return null;
    const trimmed = name.trim();
    return trimmed.length >= ECA_NAME_MIN && trimmed.length <= ECA_NAME_MAX
        ? trimmed
        : null;
}

function isValidDescription(description: unknown): description is string {
    return (
        typeof description === "string" &&
        description.length <= ECA_DESCRIPTION_MAX
    );
}

/** Exact match, not a prefix: `${ownerId}/../victim/x.png` starts with the owner's folder. */
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

/** Best effort; only an exact cover path is ever removed (legacy rows may hold anything). */
async function removeCoverObject(
    admin: AdminClient,
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

export async function listEcaGames(
    client: AdminClient,
    ownerId: string,
): Promise<Result<{ games: readonly EcaGameSummary[] }>> {
    const { data, error } = await client
        .from("eca_games")
        .select(`${SUMMARY_COLUMNS}, rules:definition->rules`)
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false });
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    return {
        ok: true,
        games: data.map((row) => ({
            ...toSummary(row),
            ruleCount: Array.isArray(row.rules) ? row.rules.length : 0,
        })),
    };
}

/** Owner in any status, anyone once published (the RLS select policy, re-enforced). */
export async function getEcaGame(
    admin: AdminClient,
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
    if (data.owner_id !== requesterId && data.status !== "published") {
        return { ok: false, error: "not_found" };
    }

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

/** The per-owner cap is the race-safe DB trigger; its check_violation is `limit_reached`. */
export async function createEcaGame(
    admin: AdminClient,
    ownerId: string,
    input: unknown,
): Promise<Result<{ id: string }>> {
    if (!isRecord(input)) return { ok: false, error: "invalid_input" };
    const name = parseName(input.name);
    if (name === null) return { ok: false, error: "invalid_input" };
    let description: string | null = null;
    if (input.description !== undefined && input.description !== null) {
        if (!isValidDescription(input.description)) {
            return { ok: false, error: "invalid_input" };
        }
        description = input.description;
    }

    const validated = validateEcaDefinitionForWrite(input.definition);
    if (!validated.ok) {
        return {
            ok: false,
            error: "invalid_definition",
            details: validated.errors,
        };
    }
    const definition = withMeta(validated.definition, name, description);

    const { data, error } = await admin
        .from("eca_games")
        .insert({
            owner_id: ownerId,
            name,
            description,
            definition: { ...definition },
        })
        .select("id")
        .single();
    if (error) {
        return {
            ok: false,
            error:
                error.code === CHECK_VIOLATION ? "limit_reached" : "db_error",
            message: error.message,
        };
    }
    return { ok: true, id: data.id };
}

async function fetchOwnedRow(admin: AdminClient, id: string, ownerId: string) {
    if (!isUuid(id)) return { ok: false, error: "not_found" } as const;
    const { data, error } = await admin
        .from("eca_games")
        .select(
            "owner_id, name, description, definition, status, image_url, moderation_locked",
        )
        .eq("id", id)
        .maybeSingle();
    if (error) {
        return {
            ok: false,
            error: "db_error",
            message: error.message,
        } as const;
    }
    if (!data || data.owner_id !== ownerId) {
        return { ok: false, error: "not_found" } as const;
    }
    return { ok: true, row: data } as const;
}

/**
 * Partial update (name / description / definition / status / image_url).
 * Anything that rewrites or publishes the definition revalidates it first; a
 * moderation-locked game stays editable but cannot be published.
 */
export async function updateEcaGame(
    admin: AdminClient,
    id: string,
    ownerId: string,
    patch: unknown,
): Promise<{ ok: true } | Failure> {
    const owned = await fetchOwnedRow(admin, id, ownerId);
    if (!owned.ok) return owned;
    const { row } = owned;

    if (!isRecord(patch)) return { ok: false, error: "invalid_input" };
    const {
        name: rawName,
        description: rawDescription,
        definition: rawDefinition,
        status: rawStatus,
        image_url: rawImage,
    } = patch;
    if (
        rawName === undefined &&
        rawDescription === undefined &&
        rawDefinition === undefined &&
        rawStatus === undefined &&
        rawImage === undefined
    ) {
        return { ok: false, error: "invalid_input" };
    }

    let namePatch: string | undefined;
    if (rawName !== undefined) {
        const parsed = parseName(rawName);
        if (parsed === null) return { ok: false, error: "invalid_input" };
        namePatch = parsed;
    }
    let descriptionPatch: string | null | undefined;
    if (rawDescription !== undefined) {
        if (rawDescription !== null && !isValidDescription(rawDescription)) {
            return { ok: false, error: "invalid_input" };
        }
        descriptionPatch = rawDescription;
    }
    let statusPatch: EcaGameStatus | undefined;
    if (rawStatus !== undefined) {
        if (rawStatus !== "draft" && rawStatus !== "published") {
            return { ok: false, error: "invalid_input" };
        }
        statusPatch = rawStatus;
    }
    if (statusPatch === "published" && row.moderation_locked) {
        return { ok: false, error: "moderation_locked" };
    }
    let imagePatch: string | null | undefined;
    if (rawImage !== undefined) {
        if (rawImage !== null && !isValidImagePath(rawImage, ownerId, id)) {
            return { ok: false, error: "invalid_input" };
        }
        imagePatch = rawImage;
    }

    const name = namePatch ?? row.name;
    const effectiveDescription =
        descriptionPatch !== undefined ? descriptionPatch : row.description;

    let definition: EcaDefinition | null = null;
    if (
        rawDefinition !== undefined ||
        statusPatch === "published" ||
        name !== row.name ||
        descriptionPatch !== undefined
    ) {
        const validated = validateEcaDefinitionForWrite(
            rawDefinition !== undefined ? rawDefinition : row.definition,
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
        update.definition = {
            ...withMeta(definition, name, effectiveDescription),
        };
    }

    // Ownership re-asserted on the write itself.
    const { error } = await admin
        .from("eca_games")
        .update(update)
        .eq("id", id)
        .eq("owner_id", ownerId);
    if (error) {
        // The moderation-lock CHECK: an admin took the game down since our read.
        if (error.code === CHECK_VIOLATION && statusPatch === "published") {
            return { ok: false, error: "moderation_locked" };
        }
        return { ok: false, error: "db_error", message: error.message };
    }

    // A new extension or a cleared cover leaves the previous object behind.
    if (imagePatch !== undefined && imagePatch !== row.image_url) {
        await removeCoverObject(admin, row.image_url, ownerId, id);
    }
    return { ok: true };
}

export interface PublishedEcaGame {
    readonly id: string;
    /** `eca:<uuid>`, ready for room creation. */
    readonly moduleId: string;
    readonly name: string;
    readonly description: string | null;
    /** Display-ready public URL. */
    readonly imageUrl: string | null;
    /** `null` without a portal pseudo. */
    readonly ownerName: string | null;
    readonly ruleCount: number;
    readonly minPlayers: number;
    readonly maxPlayers: number;
}

const COMMUNITY_LIMIT = 48;

/** Works with the RLS client: published rows are readable by any authenticated user. */
export async function listPublishedEcaGames(
    client: AdminClient,
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

    // A row that does not parse could not be launched either: leave it out.
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
                ownerName: nameOf.get(row.owner_id) ?? null,
                ruleCount: def.rules.length,
                minPlayers: def.meta.minPlayers,
                maxPlayers: def.meta.maxPlayers,
            },
        ];
    });
}

export async function deleteEcaGame(
    admin: AdminClient,
    id: string,
    ownerId: string,
): Promise<{ ok: true } | Failure> {
    const owned = await fetchOwnedRow(admin, id, ownerId);
    if (!owned.ok) return owned;

    const { error } = await admin
        .from("eca_games")
        .delete()
        .eq("id", id)
        .eq("owner_id", ownerId);
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    await removeCoverObject(admin, owned.row.image_url, ownerId, id);
    return { ok: true };
}
