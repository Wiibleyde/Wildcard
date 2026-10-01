import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { failureResponse } from "@/lib/api/respond";
import {
    adminDeleteEcaGame,
    adminSetEcaStatus,
} from "@/lib/models/adminStudio";
import { STUDIO_ERROR_STATUS } from "@/lib/models/studio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin moderation of a single studio game — cross-owner, so admin-only
 * (moderators get the read-only dashboard). PATCH toggles `status`:
 * unpublish is a take-down (moderation lock — the owner cannot re-publish),
 * publish is a restore (lock cleared, definition revalidated); DELETE removes
 * the game.
 * The owner-scoped studio API (`/api/studio/games/[id]`) is unaffected.
 */
export async function PATCH(
    request: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    if (!auth.ok) return auth.response;

    // `{ status }` only — the shared default cap is ample.
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    if (body.status !== "draft" && body.status !== "published") {
        return NextResponse.json(
            { error: "invalid_input" },
            { status: STUDIO_ERROR_STATUS.invalid_input },
        );
    }

    const admin = createAdminClient();
    const result = await adminSetEcaStatus(admin, id, body.status);
    if (!result.ok) {
        return failureResponse(
            "admin.eca.status",
            result,
            STUDIO_ERROR_STATUS,
            result.details && { details: result.details },
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
        return failureResponse("admin.eca.delete", result, STUDIO_ERROR_STATUS);
    }

    return NextResponse.json({ ok: true });
}
