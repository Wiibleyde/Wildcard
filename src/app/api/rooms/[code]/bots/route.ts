import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { ROOM_ERROR_STATUS, setBotCount } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ code: string }> },
) {
    const { code } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        count?: unknown;
    };
    if (typeof body.count !== "number") {
        return NextResponse.json(
            { error: "count (number) is required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setBotCount(admin, auth.user.id, code, body.count);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: ROOM_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ botCount: result.botCount });
}
