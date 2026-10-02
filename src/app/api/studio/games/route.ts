import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import {
    createEcaGame,
    listEcaGames,
    STUDIO_ERROR_STATUS,
    STUDIO_MAX_BODY_BYTES,
} from "@/lib/models/studio";

/** The caller's own studio games. */
export const GET = apiRoute({}, async ({ user, admin }) => {
    const result = await listEcaGames(admin, user.id);
    if (!result.ok) {
        return failureResponse("studio.list", result, STUDIO_ERROR_STATUS);
    }
    return NextResponse.json({ games: result.games });
});

/** The model validates the whole payload; a 422 carries field-level `details`. */
export const POST = apiRoute(
    {
        rateLimit: "studioWrite",
        body: true,
        maxBodyBytes: STUDIO_MAX_BODY_BYTES,
    },
    async ({ body, user, admin }) => {
        const result = await createEcaGame(admin, user.id, body);
        if (!result.ok) {
            return failureResponse(
                "studio.create",
                result,
                STUDIO_ERROR_STATUS,
                result.details && { details: result.details },
            );
        }
        return NextResponse.json({ id: result.id });
    },
);
