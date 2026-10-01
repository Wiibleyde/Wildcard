import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { failureResponse } from "@/lib/api/respond";
import { canViewGame } from "@/lib/models/access";
import { APPLY_ERROR_STATUS, getGameClientState } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    // Service-role read: authorize first (private games are members-only).
    // 404, not 403 — a private game's existence is not disclosed.
    if (!(await canViewGame(admin, id, auth.user.id))) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const result = await getGameClientState(admin, id, auth.user.id);
    if (!result.ok) {
        return failureResponse("games.get", result, APPLY_ERROR_STATUS);
    }

    return NextResponse.json(result.payload);
}
