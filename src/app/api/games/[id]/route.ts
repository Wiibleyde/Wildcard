import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { failureResponse } from "@/lib/api/respond";
import { canViewGame } from "@/lib/models/access";
import { APPLY_ERROR_STATUS, getGameSync } from "@/lib/models/game";
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

    // `?since=N` (the last version the client holds) also returns the frames
    // it missed, so the board can play each move back instead of jumping.
    const sinceParam = new URL(request.url).searchParams.get("since");
    const since = sinceParam === null ? null : Number(sinceParam);
    if (since !== null && (!Number.isInteger(since) || since < 0)) {
        return NextResponse.json(
            { error: "since must be a non-negative integer" },
            { status: 400 },
        );
    }

    const result = await getGameSync(admin, id, auth.user.id, since);
    if (!result.ok) {
        return failureResponse("games.get", result, APPLY_ERROR_STATUS);
    }

    return NextResponse.json(result.payload);
}
