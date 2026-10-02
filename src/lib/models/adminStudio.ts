import { isEcaCoverImagePath, isUuid } from "@/lib/eca/id";
import {
    type EcaValidationError,
    validateEcaDefinitionForWrite,
} from "@/lib/eca/validate";
import type { AdminClient } from "@/lib/supabase/admin";
import { ecaImagesBucket } from "@/lib/supabase/storage";
import { usernamesByIds } from "./identities";
import type { EcaGameStatus, StudioErrorCode } from "./studio";

// Moderation over every creator's games: service-role because RLS hides
// foreign drafts; callers gate on the role first.

export interface AdminEcaGame {
    readonly id: string;
    readonly ownerId: string;
    readonly ownerName: string | null;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
    readonly imageUrl: string | null;
    /** Taken down by an admin: the owner cannot re-publish it. */
    readonly moderationLocked: boolean;
    readonly createdAt: string;
    readonly updatedAt: string;
}

type AdminEcaResult =
    | { ok: true }
    | {
          ok: false;
          error: StudioErrorCode;
          details?: readonly EcaValidationError[];
          message?: string;
      };

const ADMIN_ECA_LIMIT = 200;

export async function listAllEcaGames(
    admin: AdminClient,
): Promise<AdminEcaGame[]> {
    const { data: rows, error } = await admin
        .from("eca_games")
        .select(
            "id, owner_id, name, description, status, image_url, moderation_locked, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(ADMIN_ECA_LIMIT);
    if (error) throw new Error(`listAllEcaGames failed: ${error.message}`);
    if (rows.length === 0) return [];

    const names = await usernamesByIds(
        admin,
        rows.map((r) => r.owner_id),
    );

    return rows.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        ownerName: names.get(r.owner_id) ?? null,
        name: r.name,
        description: r.description,
        status: r.status,
        imageUrl: r.image_url,
        moderationLocked: r.moderation_locked,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}

/**
 * Unpublish is a take-down (moderation lock), publish a restore (lock cleared,
 * definition revalidated so a broken game never reaches the catalog).
 */
export async function adminSetEcaStatus(
    admin: AdminClient,
    id: string,
    status: EcaGameStatus,
): Promise<AdminEcaResult> {
    if (status !== "draft" && status !== "published") {
        return { ok: false, error: "invalid_input" };
    }

    if (!isUuid(id)) return { ok: false, error: "not_found" };
    const { data: row, error } = await admin
        .from("eca_games")
        .select("definition")
        .eq("id", id)
        .maybeSingle();
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    if (!row) return { ok: false, error: "not_found" };

    if (status === "published") {
        const validated = validateEcaDefinitionForWrite(row.definition);
        if (!validated.ok) {
            return {
                ok: false,
                error: "invalid_definition",
                details: validated.errors,
            };
        }
    }

    const { error: updateError } = await admin
        .from("eca_games")
        .update({
            status,
            moderation_locked: status === "draft",
            updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    if (updateError) {
        return { ok: false, error: "db_error", message: updateError.message };
    }
    return { ok: true };
}

/** Delete any game and its cover object. */
export async function adminDeleteEcaGame(
    admin: AdminClient,
    id: string,
): Promise<AdminEcaResult> {
    if (!isUuid(id)) return { ok: false, error: "not_found" };
    const { data: row, error } = await admin
        .from("eca_games")
        .select("id, owner_id, image_url")
        .eq("id", id)
        .maybeSingle();
    if (error) {
        return { ok: false, error: "db_error", message: error.message };
    }
    if (!row) return { ok: false, error: "not_found" };

    // Scoped to the owner read above: the row deleted is the row checked.
    const { error: deleteError } = await admin
        .from("eca_games")
        .delete()
        .eq("id", id)
        .eq("owner_id", row.owner_id);
    if (deleteError) {
        return { ok: false, error: "db_error", message: deleteError.message };
    }

    // Best-effort; only this game's exact cover path is ever removed.
    if (
        row.image_url !== null &&
        isEcaCoverImagePath(row.image_url, row.owner_id, id)
    ) {
        await admin.storage
            .from(ecaImagesBucket())
            .remove([row.image_url])
            .catch(() => undefined);
    }
    return { ok: true };
}
