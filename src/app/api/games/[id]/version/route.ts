import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { canViewGame } from "@/lib/models/access";
import { getGameVersion } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lightweight change probe. Returns just `{ version, isOver }` from the public
 * meta row so the client poll/doorbell can ask "anything new?" for a few bytes
 * and pull the full redacted payload (the sibling `GET /api/games/[id]`) only
 * when `version` has advanced. Keeps steady-state polling off the secret state,
 * the action log, and the `view()` projection.
 *
 * Same access rule as the full read ({@link canViewGame}, whose positive
 * decisions are briefly memoised so this hot path stays cheap): a stranger can
 * neither watch a private game nor re-kick its bot loop through this probe.
 */
export async function GET(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    if (!(await canViewGame(admin, id, auth.user.id))) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const info = await getGameVersion(admin, id);
    if (!info) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(info);
}
