import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { APPLY_ERROR_STATUS, applyAction } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        version?: unknown;
        action?: unknown;
    };
    if (
        typeof body.version !== "number" ||
        typeof body.action !== "object" ||
        body.action === null
    ) {
        return NextResponse.json(
            { error: "version (number) and action (object) are required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await applyAction(
        admin,
        id,
        auth.user.id,
        body.version,
        body.action as Record<string, unknown>,
    );
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error, violation: result.violation },
            { status: APPLY_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({
        ok: true,
        version: result.version,
        events: result.events,
    });
}
