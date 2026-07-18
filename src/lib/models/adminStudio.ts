import type { SupabaseClient } from "@supabase/supabase-js";
import {
    type EcaValidationError,
    validateEcaDefinition,
} from "@/lib/eca/validate";
import type { Database } from "@/lib/supabase/types";
import type { EcaGameStatus, StudioErrorCode } from "./studio";
import { usernamesByIds } from "./usernames";

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
    readonly createdAt: string;
    readonly updatedAt: string;
}

type AdminEcaResult =
    | { ok: true }
    | {
          ok: false;
          error: StudioErrorCode;
          details?: readonly EcaValidationError[];
      };

/** How many games the moderation table lists at once (newest edit first). */
const ADMIN_ECA_LIMIT = 200;

/** Every studio game across all creators, most recently edited first. */
export async function listAllEcaGames(admin: Admin): Promise<AdminEcaGame[]> {
    const { data } = await admin
        .from("eca_games")
        .select(
            "id, owner_id, name, description, status, image_url, created_at, updated_at",
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
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}

/**
 * Publish or unpublish any game (moderation). Publishing re-validates the
 * stored definition — a broken game can never be forced into the published
 * catalog, the same guarantee the owner path gives.
 */
export async function adminSetEcaStatus(
    admin: Admin,
    id: string,
    status: EcaGameStatus,
): Promise<AdminEcaResult> {
    if (status !== "draft" && status !== "published") {
        return { ok: false, error: "invalid_input" };
    }

    const { data: row, error } = await admin
        .from("eca_games")
        .select("definition")
        .eq("id", id)
        .maybeSingle();
    if (error) return { ok: false, error: "db_error" };
    if (!row) return { ok: false, error: "not_found" };

    if (status === "published") {
        const validated = validateEcaDefinition(row.definition);
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
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (updateError) return { ok: false, error: "db_error" };
    return { ok: true };
}

/** Delete any game (moderation take-down). */
export async function adminDeleteEcaGame(
    admin: Admin,
    id: string,
): Promise<AdminEcaResult> {
    const { data: row, error } = await admin
        .from("eca_games")
        .select("id")
        .eq("id", id)
        .maybeSingle();
    if (error) return { ok: false, error: "db_error" };
    if (!row) return { ok: false, error: "not_found" };

    const { error: deleteError } = await admin
        .from("eca_games")
        .delete()
        .eq("id", id);
    if (deleteError) return { ok: false, error: "db_error" };
    return { ok: true };
}
