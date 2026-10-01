import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { isJsonObject, readJsonObject } from "@/lib/api/body";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import { APPLY_ERROR_STATUS, applyAction } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const limited = rateLimit("gameAction", auth.user.id);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { version, action } = parsed.body;
    if (typeof version !== "number" || !isJsonObject(action)) {
        return NextResponse.json(
            { error: "version (number) and action (object) are required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await applyAction(admin, id, auth.user.id, version, action);
    if (!result.ok) {
        return failureResponse("games.actions", result, APPLY_ERROR_STATUS, {
            violation: result.violation,
        });
    }

    return NextResponse.json({
        ok: true,
        version: result.version,
        events: result.events,
        payload: result.payload,
    });
}
