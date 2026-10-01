import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { failureResponse } from "@/lib/api/respond";
import { type PersistErrorCode, setPersistent } from "@/lib/models/persistence";
import { createAdminClient } from "@/lib/supabase/admin";

const HTTP_STATUS: Record<PersistErrorCode, number> = {
    not_participant: 403,
    cap_reached: 409,
    db_error: 500,
};

// Pin/unpin a replay (exempt from 15-day sweep, capped at 5/account). The model verifies
// the caller actually played the game before the service-role write.
export async function PUT(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { persistent } = parsed.body;
    if (typeof persistent !== "boolean") {
        return NextResponse.json(
            { error: "persistent (boolean) is required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setPersistent(admin, auth.user.id, id, persistent);
    if (!result.ok) {
        return failureResponse("games.persist", result, HTTP_STATUS);
    }

    return NextResponse.json({ persistent, count: result.count });
}
