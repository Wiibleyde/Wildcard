import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import { createRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const limited = rateLimit("roomCreate", auth.user.id);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { moduleId } = parsed.body;
    if (typeof moduleId !== "string") {
        return NextResponse.json(
            { error: "moduleId is required" },
            { status: 400 },
        );
    }
    // Hand-made rooms are private (code-only) unless explicitly public.
    const visibility =
        parsed.body.visibility === "public" ? "public" : "private";

    const admin = createAdminClient();
    const result = await createRoom(admin, auth.user.id, moduleId, visibility);
    if (!result.ok) {
        return failureResponse("rooms.create", result, ROOM_ERROR_STATUS);
    }

    return NextResponse.json({ code: result.code, roomId: result.roomId });
}
