import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { GAME_ERROR_STATUS } from "@/lib/models/game/errors";
import { endGame } from "@/lib/models/game/settle";

// Moderators reach the dashboard, but only admins may abort.
export const POST = apiRoute<{ id: string }>(
    { role: "admin" },
    async ({ params, admin }) => {
        const result = await endGame(admin, params.id, { reason: "admin" });
        if (!result.ok) {
            return failureResponse(
                "admin.games.end",
                result,
                GAME_ERROR_STATUS,
            );
        }
        return NextResponse.json({ ok: true, version: result.version });
    },
);
