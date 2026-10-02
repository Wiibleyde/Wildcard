import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { stringField } from "@/lib/api/validate";
import {
    clearTicket,
    enqueue,
    getMatchStatus,
    leaveQueue,
    MATCH_ERROR_STATUS,
} from "@/lib/models/matchmaking";

export const POST = apiRoute(
    { rateLimit: "matchmaking", body: true },
    async ({ body, user, admin }) => {
        const moduleId = stringField(body, "moduleId");
        const result = await enqueue(admin, user.id, moduleId);
        if (!result.ok) {
            return failureResponse(
                "matchmaking.enqueue",
                result,
                MATCH_ERROR_STATUS,
            );
        }
        const { ok: _ok, ...status } = result;
        return NextResponse.json(status);
    },
);

export const GET = apiRoute({}, async ({ user, admin }) =>
    NextResponse.json(await getMatchStatus(admin, user.id)),
);

/** Drops a searching ticket; `?all=1` also consumes a spent match. */
export const DELETE = apiRoute({}, async ({ request, user, admin }) => {
    const all = new URL(request.url).searchParams.get("all") === "1";
    const result = all
        ? await clearTicket(admin, user.id)
        : await leaveQueue(admin, user.id);
    if (!result.ok) {
        return failureResponse("matchmaking.leave", result, MATCH_ERROR_STATUS);
    }
    return NextResponse.json({ ok: true });
});
