import { NextResponse } from "next/server";
import { leaveRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
    _request: Request,
    ctx: { params: Promise<{ code: string }> },
) {
    const { code } = await ctx.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const result = await leaveRoom(admin, user.id, code);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: ROOM_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ ok: true });
}
