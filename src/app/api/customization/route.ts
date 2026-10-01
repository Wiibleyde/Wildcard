import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonBody } from "@/lib/api/body";
import { failureResponse } from "@/lib/api/respond";
import {
    type CustomizationPatchErrorCode,
    parseCustomizationPatch,
    patchCustomization,
} from "@/lib/models/customization";

const HTTP_STATUS: Record<CustomizationPatchErrorCode, number> = {
    nothing_to_update: 400,
    deck_style_not_owned: 403,
    board_style_not_owned: 403,
    db_error: 500,
};

export async function PATCH(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const patch = parseCustomizationPatch(parsed.body);
    if (!patch) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const result = await patchCustomization(auth.supabase, auth.user.id, patch);
    if (!result.ok) {
        return failureResponse("customization.patch", result, HTTP_STATUS);
    }

    return NextResponse.json({ ok: true });
}
