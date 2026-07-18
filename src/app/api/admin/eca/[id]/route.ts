import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import {
    adminDeleteEcaGame,
    adminSetEcaStatus,
} from "@/lib/models/adminStudio";
import { STUDIO_ERROR_STATUS } from "@/lib/models/studio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin moderation of a single studio game — cross-owner, so admin-only
 * (moderators get the read-only dashboard). PATCH toggles `status`
 * (publish / unpublish, revalidated on publish); DELETE takes the game down.
 * The owner-scoped studio API (`/api/studio/games/[id]`) is unaffected.
 */
export async function PATCH(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        status?: unknown;
    };
    if (body.status !== "draft" && body.status !== "published") {
        return NextResponse.json(
            { error: "invalid_input" },
            { status: STUDIO_ERROR_STATUS.invalid_input },
        );
    }

    const admin = createAdminClient();
    const result = await adminSetEcaStatus(admin, id, body.status);
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

export async function DELETE(
    _request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await adminDeleteEcaGame(admin, id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: STUDIO_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ ok: true });
}
