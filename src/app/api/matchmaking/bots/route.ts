import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { MATCH_ERROR_STATUS, playWithBots } from "@/lib/models/matchmaking";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST — stop searching and deal a private game filled with bots, right now. */
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
    const result = await playWithBots(admin, auth.user.id, body.moduleId);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: MATCH_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ gameId: result.gameId });
}
