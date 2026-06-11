import { NextResponse } from "next/server";
import {
    type ProfilePatchErrorCode,
    parseProfilePatch,
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

    const body: unknown = await request.json().catch(() => null);
    const patch = parseProfilePatch(body);
    if (!patch) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const result = await patchProfile(supabase, user.id, patch);

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: HTTP_STATUS[result.error] ?? 500 },
        );
    }

    return NextResponse.json({ ok: true });
}
