import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
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
    const result = await enqueue(admin, auth.user.id, body.moduleId);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: MATCH_ERROR_STATUS[result.error] },
        );
    }

    const { ok: _ok, ...status } = result;
    return NextResponse.json(status);
}

/** GET — the caller's current ticket status (idle | searching | matched). */
export async function GET() {
    const auth = await requireUser();
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
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const all = new URL(request.url).searchParams.get("all") === "1";
    const admin = createAdminClient();
    if (all) await clearTicket(admin, auth.user.id);
    else await leaveQueue(admin, auth.user.id);
    return NextResponse.json({ ok: true });
}
