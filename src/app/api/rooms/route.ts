import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { createRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        moduleId?: unknown;
    };
    if (typeof body.moduleId !== "string") {
        return NextResponse.json(
            { error: "moduleId is required" },
            { status: 400 },
        );
    }

    const admin = createAdminClient();
    const result = await createRoom(admin, auth.user.id, body.moduleId);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: ROOM_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ code: result.code, roomId: result.roomId });
}
