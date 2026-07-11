import type { SupabaseClient } from "@supabase/supabase-js";
import {
    ECA_DESCRIPTION_MAX,
    ECA_NAME_MAX,
    ECA_NAME_MIN,
    type EcaDefinition,
    type EcaValidationError,
    validateEcaDefinition,
} from "@/lib/eca";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * Studio persistence — CRUD over `eca_games`, the table of creator-authored
 * ECA definitions.
 *
 * Every write revalidates the untrusted definition JSON with
 * {@link validateEcaDefinition} before it touches the database (the DB CHECK
 * constraints only guard cheap scalar invariants). Ownership is enforced here
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
    | "db_error";

/** HTTP status for each studio error — keeps the route handlers thin. */
export const STUDIO_ERROR_STATUS: Record<StudioErrorCode, number> = {
    not_found: 404,
    invalid_definition: 422,
    invalid_input: 400,
    limit_reached: 409,
    db_error: 500,
};

/** Per-owner cap on studio games. Mirrors the DB trigger (`eca_games_cap`). */
export const MAX_ECA_GAMES_PER_OWNER = 20;

export type EcaGameStatus = "draft" | "published";

/** List projection — everything but the (potentially large) definition. */
export interface EcaGameSummary {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
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
};
type Result<T> = ({ ok: true } & T) | Failure;

const SUMMARY_COLUMNS =
    "id, owner_id, name, description, status, created_at, updated_at";

type SummaryRow = {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    status: EcaGameStatus;
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
    if (error) return { ok: false, error: "db_error" };
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
    const { data, error } = await admin
        .from("eca_games")
        .select(`${SUMMARY_COLUMNS}, definition`)
        .eq("id", id)
        .maybeSingle();
    if (error) return { ok: false, error: "db_error" };
    if (!data) return { ok: false, error: "not_found" };
    // Rows the requester cannot see under the RLS select policy answer
    // `not_found` (not a distinct `forbidden`) so the endpoint never confirms
    // a draft id exists to an outsider — same convention as replay.ts.
    if (data.owner_id !== requesterId && data.status !== "published") {
        return { ok: false, error: "not_found" };
    }

    // Stored definitions were validated on write; re-narrowing here (instead
    // of casting the jsonb) keeps the invariant checked end to end.
    const validated = validateEcaDefinition(data.definition);
    if (!validated.ok) return { ok: false, error: "db_error" };

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

    const validated = validateEcaDefinition(body.definition);
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
            definition: definition as unknown as Record<string, unknown>,
        })
        .select("id")
        .single();
    if (error) {
        // The cap trigger raises check_violation past the cap.
        return {
            ok: false,
            error: error.code === "23514" ? "limit_reached" : "db_error",
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
 */
export async function updateEcaGame(
    admin: Admin,
    id: string,
    ownerId: string,
    patch: unknown,
): Promise<{ ok: true } | Failure> {
    const { data: row, error: fetchError } = await admin
        .from("eca_games")
        .select("owner_id, name, description, definition, status")
        .eq("id", id)
        .maybeSingle();
    if (fetchError) return { ok: false, error: "db_error" };
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
    };
    if (
        body.name === undefined &&
        body.description === undefined &&
        body.definition === undefined &&
        body.status === undefined
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
        const validated = validateEcaDefinition(
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

    const update: Database["public"]["Tables"]["eca_games"]["Update"] = {
        updated_at: new Date().toISOString(),
    };
    if (namePatch !== undefined) update.name = namePatch;
    if (descriptionPatch !== undefined) update.description = descriptionPatch;
    if (statusPatch !== undefined) update.status = statusPatch;
    if (definition !== null) {
        // definition.meta mirrors the row name/description columns (single
        // source of truth) so the stored copies can never drift.
        update.definition = withMeta(
            definition,
            name,
            effectiveDescription,
        ) as unknown as Record<string, unknown>;
    }

    const { error } = await admin.from("eca_games").update(update).eq("id", id);
    if (error) return { ok: false, error: "db_error" };
    return { ok: true };
}

/** Delete an owned game. */
export async function deleteEcaGame(
    admin: Admin,
    id: string,
    ownerId: string,
): Promise<{ ok: true } | Failure> {
    const { data: row, error: fetchError } = await admin
        .from("eca_games")
        .select("owner_id")
        .eq("id", id)
        .maybeSingle();
    if (fetchError) return { ok: false, error: "db_error" };
    if (!row) return { ok: false, error: "not_found" };
    // Foreign rows answer `not_found` (never `forbidden`) so a mutation can
    // confirm neither a draft's existence nor write access — same convention
    // as replay.ts.
    if (row.owner_id !== ownerId) return { ok: false, error: "not_found" };

    const { error } = await admin.from("eca_games").delete().eq("id", id);
    if (error) return { ok: false, error: "db_error" };
    return { ok: true };
}
