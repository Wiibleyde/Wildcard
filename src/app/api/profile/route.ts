import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import {
    type ProfilePatchErrorCode,
    parseProfilePatch,
    patchProfile,
} from "@/lib/models/profile";

const HTTP_STATUS: Record<ProfilePatchErrorCode, number> = {
    username_empty: 400,
    username_taken: 409,
    db_error: 500,
};

export async function PATCH(request: Request) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body: unknown = await request.json().catch(() => null);
    const patch = parseProfilePatch(body);
    if (!patch) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const result = await patchProfile(auth.supabase, auth.user.id, patch);

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: HTTP_STATUS[result.error] ?? 500 },
        );
    }

    return NextResponse.json({ ok: true });
}
