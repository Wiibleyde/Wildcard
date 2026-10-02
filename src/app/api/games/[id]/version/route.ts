import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { canViewGame } from "@/lib/models/access";
import { GAME_ERROR_STATUS } from "@/lib/models/game/errors";
import { getGameVersion } from "@/lib/models/game/payload";

// Cheap change probe; same access rule as the full read, so a stranger can
// neither watch a private game nor re-kick its bot chain through it.
export const GET = apiRoute<{ id: string }>(
    {},
    async ({ params, user, admin }) => {
        if (!(await canViewGame(admin, params.id, user.id))) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        const result = await getGameVersion(admin, params.id);
        if (!result.ok) {
            return failureResponse("games.version", result, GAME_ERROR_STATUS);
        }
        return NextResponse.json(result.info);
    },
);
