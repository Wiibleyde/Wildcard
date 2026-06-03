import { NextResponse } from "next/server";
import {
    type CustomizationPatch,
    type CustomizationPatchErrorCode,
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

    const body = (await request.json()) as CustomizationPatch;
    const result = await patchCustomization(supabase, user.id, body);

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: HTTP_STATUS[result.error] ?? 500 },
        );
    }

    return NextResponse.json({ ok: true });
}
