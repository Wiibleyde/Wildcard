import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { ROOM_ERROR_STATUS, setRules } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ code: string }> },
) {
    const { code } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        rules?: unknown;
    };
    if (
        typeof body.rules !== "object" ||
        body.rules === null ||
        Array.isArray(body.rules)
    ) {
        return NextResponse.json(
            { error: "rules (object) is required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setRules(
        admin,
        auth.user.id,
        code,
        body.rules as Record<string, unknown>,
    );
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: ROOM_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ rules: result.rules });
}
