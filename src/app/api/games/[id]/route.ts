import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { APPLY_ERROR_STATUS, getGameClientState } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await getGameClientState(admin, id, auth.user.id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: APPLY_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json(result.payload);
}
