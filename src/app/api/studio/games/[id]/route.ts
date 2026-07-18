import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import {
    deleteEcaGame,
    getEcaGame,
    STUDIO_ERROR_STATUS,
    updateEcaGame,
} from "@/lib/models/studio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One full game (definition included) — own in any status, or published.
 * Anything else is a 404 (never a 403), so a foreign draft's existence is
 * never confirmed.
 */
export async function GET(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await getEcaGame(admin, id, auth.user.id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: STUDIO_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ game: result.game });
}

/**
 * Partial update of an owned game — any subset of name / description /
 * definition / status / image_url. Name and description are mirrored into the stored
 * `definition.meta` so the columns stay authoritative. Invalid definitions
 * come back as a 422 with field-level `details`; a game the caller does not
 * own is a 404 (never a 403).
 */
export async function PATCH(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body: unknown = await request.json().catch(() => ({}));

    const admin = createAdminClient();
    const result = await updateEcaGame(admin, id, auth.user.id, body);
    if (!result.ok) {
        return NextResponse.json(
            {
                error: result.error,
                ...(result.details && { details: result.details }),
            },
            { status: STUDIO_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ ok: true });
}

/** Delete an owned game. A game the caller does not own is a 404. */
export async function DELETE(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await deleteEcaGame(admin, id, auth.user.id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: STUDIO_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ ok: true });
}
