import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type ProfilesUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export interface ProfilePatch {
    username?: string;
    avatar_url?: string | null;
}

export type ProfilePatchErrorCode =
    | "username_empty"
    | "username_taken"
    | "db_error";

/** Server-side cap — mirrors the form's `maxLength={30}`. */
const USERNAME_MAX_LENGTH = 30;
const AVATAR_URL_MAX_LENGTH = 2048;

/**
 * Narrow an unknown request body into a {@link ProfilePatch}, or `null` when
 * the shape is invalid. The API boundary must never trust a client cast.
 */
export function parseProfilePatch(body: unknown): ProfilePatch | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return null;
    }
    const record = body as Record<string, unknown>;
    const patch: ProfilePatch = {};

    if ("username" in record) {
        const { username } = record;
        if (
            typeof username !== "string" ||
            username.length > USERNAME_MAX_LENGTH
        ) {
            return null;
        }
        patch.username = username;
    }

    if ("avatar_url" in record) {
        const avatar = record.avatar_url;
        if (avatar !== null && typeof avatar !== "string") return null;
        if (
            typeof avatar === "string" &&
            avatar.length > AVATAR_URL_MAX_LENGTH
        ) {
            return null;
        }
        patch.avatar_url = avatar;
    }

    return patch;
}

type PatchResult =
    | { ok: true }
    | { ok: false; error: ProfilePatchErrorCode; message?: string };

export async function patchProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    input: ProfilePatch,
): Promise<PatchResult> {
    const updates: ProfilesUpdate = {};

    if (input.username !== undefined) {
        const trimmed = input.username.trim();
        if (!trimmed) return { ok: false, error: "username_empty" };
        updates.username = trimmed;
    }

    if (input.avatar_url !== undefined) {
        updates.avatar_url = input.avatar_url;
    }

    const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

    if (error) {
        if (error.code === "23505")
            return { ok: false, error: "username_taken" };
        return { ok: false, error: "db_error", message: error.message };
    }

    return { ok: true };
}
