import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { rateLimit } from "@/lib/api/rateLimit";
import { failureResponse } from "@/lib/api/respond";
import {
    createEcaGame,
    listEcaGames,
    STUDIO_ERROR_STATUS,
    STUDIO_MAX_BODY_BYTES,
} from "@/lib/models/studio";
import { createAdminClient } from "@/lib/supabase/admin";

/** List the caller's own studio games (summaries, newest edit first). */
export async function GET() {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await listEcaGames(admin, auth.user.id);
    if (!result.ok) {
        return failureResponse("studio.list", result, STUDIO_ERROR_STATUS);
    }

    return NextResponse.json({ games: result.games });
}

/**
 * Create a studio game from `{name, description?, definition}`. The body is
 * size-capped before parsing; the model validates the whole payload
 * (definition via validateEcaDefinitionForWrite) — a 422 carries the
 * field-level `details` so the editor can pinpoint the errors.
 */
export async function POST(request: Request) {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const limited = rateLimit("studioWrite", auth.user.id);
    if (limited) return limited;

    const parsed = await readJsonObject(request, STUDIO_MAX_BODY_BYTES);
    if (!parsed.ok) return parsed.response;

    const admin = createAdminClient();
    const result = await createEcaGame(admin, auth.user.id, parsed.body);
    if (!result.ok) {
        return failureResponse(
            "studio.create",
            result,
            STUDIO_ERROR_STATUS,
            result.details && { details: result.details },
        );
    }

    return NextResponse.json({ id: result.id });
}
