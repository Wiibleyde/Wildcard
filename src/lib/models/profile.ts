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
    if (error.code === "23505") return { ok: false, error: "username_taken" };
    return { ok: false, error: "db_error", message: error.message };
  }

  return { ok: true };
}
