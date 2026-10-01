import type { SupabaseClient } from "@supabase/supabase-js";
import { isEcaCoverImagePath, isUuid } from "@/lib/eca/id";
import {
    type EcaValidationError,
    validateEcaDefinitionForWrite,
} from "@/lib/eca/validate";
import { ecaImagesBucket } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";
import { usernamesByIds } from "./identities";
import type { EcaGameStatus, StudioErrorCode } from "./studio";

type Admin = SupabaseClient<Database>;

/**
 * Admin / moderation view over **every** creator's studio games — the
 * counterpart to the owner-scoped {@link import("./studio")} model.
 *
 * These functions run on the service-role client and deliberately do NOT scope
 * by owner: the RLS select policy on `eca_games` only exposes a caller's own
 * rows plus published ones, so a moderator could never see foreign *drafts*
 * through an RLS client. Access is gated at the page/route level by role
 * (`requireRole`), and every function here is read-or-moderate only — creators
 * still author their games through the studio API.
 */

export interface AdminEcaGame {
    readonly id: string;
    readonly ownerId: string;
    /** Creator's display name, or null if the profile row is gone. */
    readonly ownerName: string | null;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
    readonly imageUrl: string | null;
    /** Taken down by an admin — the owner cannot re-publish it. */
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
          /** Internal detail (DB/driver text) — logged on 5xx, never sent. */
          message?: string;
      };

/** How many games the moderation table lists at once (newest edit first). */
const ADMIN_ECA_LIMIT = 200;

/** Every studio game across all creators, most recently edited first. */
export async function listAllEcaGames(admin: Admin): Promise<AdminEcaGame[]> {
    const { data } = await admin
        .from("eca_games")
        .select(
            "id, owner_id, name, description, status, image_url, moderation_locked, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(ADMIN_ECA_LIMIT);
    const rows = data ?? [];
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
 * Publish or unpublish any game (moderation). Publishing re-validates the
 * stored definition — a broken game can never be forced into the published
 * catalog, the same guarantee the owner path gives.
 *
 * The status change carries the moderation lock with it: an admin unpublish
 * is a TAKE-DOWN (`moderation_locked = true` — the owner can edit but not
 * re-publish), an admin publish is a RESTORE (lock cleared). The DB CHECK
 * `eca_games_locked_not_published` keeps the pair consistent.
 */
export async function adminSetEcaStatus(
    admin: Admin,
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

/** Delete any game (moderation take-down), and its cover object. */
export async function adminDeleteEcaGame(
    admin: Admin,
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

    // Best-effort: only an exact cover path for this game is ever removed.
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
