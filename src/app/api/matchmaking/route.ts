import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import {
    clearTicket,
    enqueue,
    getMatchStatus,
    leaveQueue,
    MATCH_ERROR_STATUS,
} from "@/lib/models/matchmaking";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST — join the quick-match queue for a game and try to form a match. */
export async function POST(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

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
    const result = await enqueue(admin, auth.user.id, moduleId);
    if (!result.ok) {
        return failureResponse(
            "matchmaking.enqueue",
            result,
            MATCH_ERROR_STATUS,
        );
    }

    const { ok: _ok, ...status } = result;
    return NextResponse.json(status);
}

/** GET — the caller's current ticket status (idle | searching | matched). */
export async function GET(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const status = await getMatchStatus(admin, auth.user.id);
    return NextResponse.json(status);
}

/**
 * DELETE — leave the queue. Default drops only a still-searching ticket (the
 * "Annuler" button); `?all=1` drops it unconditionally to consume a spent match
 * once the player has entered the game.
 */
export async function DELETE(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const all = new URL(request.url).searchParams.get("all") === "1";
    const admin = createAdminClient();
    if (all) await clearTicket(admin, auth.user.id);
    else await leaveQueue(admin, auth.user.id);
    return NextResponse.json({ ok: true });
}
