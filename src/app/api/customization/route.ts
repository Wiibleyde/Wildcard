import { NextResponse } from "next/server";
import {
    type CustomizationPatchErrorCode,
    parseCustomizationPatch,
    patchCustomization,
} from "@/lib/models/customization";
import { createClient } from "@/lib/supabase/server";

const HTTP_STATUS: Record<CustomizationPatchErrorCode, number> = {
    nothing_to_update: 400,
    deck_style_not_owned: 403,
    board_style_not_owned: 403,
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
    const patch = parseCustomizationPatch(body);
    if (!patch) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const result = await patchCustomization(supabase, user.id, patch);

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: HTTP_STATUS[result.error] ?? 500 },
        );
    }

    return NextResponse.json({ ok: true });
}
