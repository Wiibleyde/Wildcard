import { NextResponse } from "next/server";
import {
  type ProfilePatch,
  type ProfilePatchErrorCode,
  patchProfile,
} from "@/lib/models/profile";
import { createClient } from "@/lib/supabase/server";

const HTTP_STATUS: Record<ProfilePatchErrorCode, number> = {
  username_empty: 400,
  username_taken: 409,
  db_error: 500,
};

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProfilePatch;
  const result = await patchProfile(supabase, user.id, body);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: HTTP_STATUS[result.error] ?? 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
