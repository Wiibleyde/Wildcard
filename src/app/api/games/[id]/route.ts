import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { invalidInput } from "@/lib/api/validate";
import { canViewGame } from "@/lib/models/access";
import { GAME_ERROR_STATUS } from "@/lib/models/game/errors";
import { getGameSync } from "@/lib/models/game/payload";

export const GET = apiRoute<{ id: string }>(
    {},
    async ({ request, params, user, admin }) => {
        // 404, not 403: a private game's existence is not disclosed.
        if (!(await canViewGame(admin, params.id, user.id))) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        // `?since=N` also returns the frames the client missed.
        const sinceParam = new URL(request.url).searchParams.get("since");
        const since = sinceParam === null ? null : Number(sinceParam);
        if (since !== null && (!Number.isInteger(since) || since < 0)) {
            return invalidInput("since");
        }

        const result = await getGameSync(admin, params.id, user.id, since);
        if (!result.ok) {
            return failureResponse("games.get", result, GAME_ERROR_STATUS);
        }
        return NextResponse.json(result.payload);
    },
);
