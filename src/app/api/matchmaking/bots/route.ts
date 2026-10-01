import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import { MATCH_ERROR_STATUS, playWithBots } from "@/lib/models/matchmaking";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST — stop searching and deal a private game filled with bots, right now. */
export async function POST(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    // Every call deals a whole game: share the matchmaking budget.
    const limited = rateLimit("matchmaking", auth.user.id);
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

    const admin = createAdminClient();
    const result = await playWithBots(admin, auth.user.id, moduleId);
    if (!result.ok) {
        return failureResponse("matchmaking.bots", result, MATCH_ERROR_STATUS);
    }

    return NextResponse.json({ gameId: result.gameId });
}
