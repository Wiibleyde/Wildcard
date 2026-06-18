import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { APPLY_ERROR_STATUS, endGame } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-only: force-end a live game. The dashboard is reachable by moderators
 * too, but only admins may abort a game, so the role is re-checked server-side
 * (defense in depth) before the service-role write.
 */
export async function POST(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await endGame(admin, id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: APPLY_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ ok: true, version: result.version });
}
