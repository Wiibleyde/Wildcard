import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { failureResponse } from "@/lib/api/respond";
import { ROOM_ERROR_STATUS, setRoomRole } from "@/lib/models/room";
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
    const { role } = parsed.body;
    if (role !== "player" && role !== "spectator") {
        return NextResponse.json(
            { error: "role must be 'player' or 'spectator'" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await setRoomRole(admin, auth.user.id, code, role);
    if (!result.ok) {
        return failureResponse("rooms.role", result, ROOM_ERROR_STATUS);
    }

    return NextResponse.json({ role: result.role });
}
