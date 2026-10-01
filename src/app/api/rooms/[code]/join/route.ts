import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import { joinRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
    request: Request,
    ctx: { params: Promise<{ code: string }> },
) {
    const { code } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    // Joining by code is how private rooms are reached: throttle it so the
    // code space cannot be brute-forced.
    const limited = rateLimit("roomJoin", auth.user.id);
    if (limited) return limited;

    const admin = createAdminClient();
    const result = await joinRoom(admin, auth.user.id, code);
    if (!result.ok) {
        return failureResponse("rooms.join", result, ROOM_ERROR_STATUS);
    }

    return NextResponse.json({ roomId: result.roomId });
}
