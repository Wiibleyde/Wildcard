import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { failureResponse } from "@/lib/api/respond";
import { ROOM_ERROR_STATUS, startGame } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ code: string }> },
) {
    const { code } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await startGame(admin, auth.user.id, code);
    if (!result.ok) {
        return failureResponse("rooms.start", result, ROOM_ERROR_STATUS);
    }

    return NextResponse.json({ gameId: result.gameId });
}
