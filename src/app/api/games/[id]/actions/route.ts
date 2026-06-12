import { NextResponse } from "next/server";
import { APPLY_ERROR_STATUS, applyAction } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        user.id,
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
