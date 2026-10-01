import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { isJsonObject, readJsonObject } from "@/lib/api/body";
import { failureResponse } from "@/lib/api/respond";
import { ROOM_ERROR_STATUS, setRules } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ code: string }> },
) {
    const { code } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { rules } = parsed.body;
    if (!isJsonObject(rules)) {
        return NextResponse.json(
            { error: "rules (object) is required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setRules(admin, auth.user.id, code, rules);
    if (!result.ok) {
        return failureResponse("rooms.rules", result, ROOM_ERROR_STATUS);
    }

    return NextResponse.json({ rules: result.rules });
}
