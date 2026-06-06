import { NextResponse } from "next/server";
import { APPLY_ERROR_STATUS, getGameClientState } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const result = await getGameClientState(admin, id, user.id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: APPLY_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json(result.payload);
}
