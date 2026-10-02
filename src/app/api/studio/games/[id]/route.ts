import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import {
    deleteEcaGame,
    getEcaGame,
    STUDIO_ERROR_STATUS,
    STUDIO_MAX_BODY_BYTES,
    updateEcaGame,
} from "@/lib/models/studio";

// A game the caller may not see is a 404, never a 403: a foreign draft's
// existence is never confirmed.

export const GET = apiRoute<{ id: string }>(
    {},
    async ({ params, user, admin }) => {
        const result = await getEcaGame(admin, params.id, user.id);
        if (!result.ok) {
            return failureResponse("studio.get", result, STUDIO_ERROR_STATUS);
        }
        return NextResponse.json({ game: result.game });
    },
);

/** Partial update; 422 with `details` for an invalid definition, 423 `moderation_locked` on publish. */
export const PATCH = apiRoute<{ id: string }>(
    {
        rateLimit: "studioWrite",
        body: true,
        maxBodyBytes: STUDIO_MAX_BODY_BYTES,
    },
    async ({ params, body, user, admin }) => {
        const result = await updateEcaGame(admin, params.id, user.id, body);
        if (!result.ok) {
            return failureResponse(
                "studio.update",
                result,
                STUDIO_ERROR_STATUS,
                result.details && { details: result.details },
            );
        }
        return NextResponse.json({ ok: true });
    },
);

export const DELETE = apiRoute<{ id: string }>(
    { rateLimit: "studioWrite" },
    async ({ params, user, admin }) => {
        const result = await deleteEcaGame(admin, params.id, user.id);
        if (!result.ok) {
            return failureResponse(
                "studio.delete",
                result,
                STUDIO_ERROR_STATUS,
            );
        }
        return NextResponse.json({ ok: true });
    },
);
