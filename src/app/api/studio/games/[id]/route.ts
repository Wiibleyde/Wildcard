import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import {
    deleteEcaGame,
    getEcaGame,
    STUDIO_ERROR_STATUS,
    STUDIO_MAX_BODY_BYTES,
    updateEcaGame,
} from "@/lib/models/studio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One full game (definition included) — own in any status, or published.
 * Anything else is a 404 (never a 403), so a foreign draft's existence is
 * never confirmed.
 */
export async function GET(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await getEcaGame(admin, id, auth.user.id);
    if (!result.ok) {
        return failureResponse("studio.get", result, STUDIO_ERROR_STATUS);
    }

    return NextResponse.json({ game: result.game });
}

/**
 * Partial update of an owned game — any subset of name / description /
 * definition / status / image_url. Name and description are mirrored into the stored
 * `definition.meta` so the columns stay authoritative. Invalid definitions
 * come back as a 422 with field-level `details`; a game the caller does not
 * own is a 404 (never a 403); publishing a game taken down by an admin is a
 * 423 `moderation_locked`.
 */
export async function PATCH(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const limited = rateLimit("studioWrite", auth.user.id);
    if (limited) return limited;

    const parsed = await readJsonObject(request, STUDIO_MAX_BODY_BYTES);
    if (!parsed.ok) return parsed.response;

    const admin = createAdminClient();
    const result = await updateEcaGame(admin, id, auth.user.id, parsed.body);
    if (!result.ok) {
        return failureResponse(
            "studio.update",
            result,
            STUDIO_ERROR_STATUS,
            result.details && { details: result.details },
        );
    }

    return NextResponse.json({ ok: true });
}

/** Delete an owned game. A game the caller does not own is a 404. */
export async function DELETE(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const limited = rateLimit("studioWrite", auth.user.id);
    if (limited) return limited;

    const admin = createAdminClient();
    const result = await deleteEcaGame(admin, id, auth.user.id);
    if (!result.ok) {
        return failureResponse("studio.delete", result, STUDIO_ERROR_STATUS);
    }

    return NextResponse.json({ ok: true });
}
