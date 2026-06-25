import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getGameVersion } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lightweight change probe. Returns just `{ version, isOver }` from the public
 * meta row so the client poll/doorbell can ask "anything new?" for a few bytes
 * and pull the full redacted payload (the sibling `GET /api/games/[id]`) only
 * when `version` has advanced. Keeps steady-state polling off the secret state,
 * the action log, and the `view()` projection.
 */
export async function GET(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const info = await getGameVersion(admin, id);
    if (!info) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(info);
}
