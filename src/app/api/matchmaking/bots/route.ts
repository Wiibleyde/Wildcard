import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { stringField } from "@/lib/api/validate";
import { MATCH_ERROR_STATUS, playWithBots } from "@/lib/models/matchmaking";

// Deals a whole game: shares the matchmaking budget.
export const POST = apiRoute(
    { rateLimit: "matchmaking", body: true },
    async ({ body, user, admin }) => {
        const moduleId = stringField(body, "moduleId");
        const result = await playWithBots(admin, user.id, moduleId);
        if (!result.ok) {
            return failureResponse(
                "matchmaking.bots",
                result,
                MATCH_ERROR_STATUS,
            );
        }
        return NextResponse.json({ gameId: result.gameId });
    },
);
