import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import {
    createEcaGame,
    listEcaGames,
    STUDIO_ERROR_STATUS,
} from "@/lib/models/studio";
import { createAdminClient } from "@/lib/supabase/admin";

/** List the caller's own studio games (summaries, newest edit first). */
export async function GET() {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const result = await listEcaGames(admin, auth.user.id);
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: STUDIO_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ games: result.games });
}

/**
 * Create a studio game from `{name, description?, definition}`. The model
 * validates the whole payload (definition via validateEcaDefinition) — a 422
 * carries the field-level `details` so the editor can pinpoint the errors.
 */
export async function POST(request: Request) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body: unknown = await request.json().catch(() => ({}));

    const admin = createAdminClient();
    const result = await createEcaGame(admin, auth.user.id, body);
    if (!result.ok) {
        return NextResponse.json(
            {
                error: result.error,
                ...(result.details && { details: result.details }),
            },
            { status: STUDIO_ERROR_STATUS[result.error] },
        );
    }

    return NextResponse.json({ id: result.id });
}
