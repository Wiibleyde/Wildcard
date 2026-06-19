import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { type PersistErrorCode, setPersistent } from "@/lib/models/persistence";
import { createAdminClient } from "@/lib/supabase/admin";

const HTTP_STATUS: Record<PersistErrorCode, number> = {
    not_participant: 403,
    cap_reached: 409,
    db_error: 500,
};

/**
 * Pin / unpin a game's replay for the signed-in user. Pinned replays are exempt
 * from the 15-day retention sweep (capped at 5 per account). The model verifies
 * the caller actually played in the game before pinning; writes go through the
 * service role after that check.
 */
export async function PUT(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        persistent?: unknown;
    };
    if (typeof body.persistent !== "boolean") {
        return NextResponse.json(
            { error: "persistent (boolean) is required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setPersistent(
        admin,
        auth.user.id,
        id,
        body.persistent,
    );
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: HTTP_STATUS[result.error] },
        );
    }

    return NextResponse.json({
        persistent: body.persistent,
        count: result.count,
    });
}
