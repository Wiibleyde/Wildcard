import { NextResponse } from "next/server";
import { ROOM_ERROR_STATUS, setRoomRole } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
    request: Request,
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

    const body = (await request.json().catch(() => ({}))) as {
        role?: unknown;
    };
    if (body.role !== "player" && body.role !== "spectator") {
        return NextResponse.json(
            { error: "role must be 'player' or 'spectator'" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setRoomRole(admin, user.id, code, body.role);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: ROOM_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ role: result.role });
}
