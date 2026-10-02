import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { numberField, objectField } from "@/lib/api/validate";
import { applyAction } from "@/lib/models/game/apply";
import { GAME_ERROR_STATUS } from "@/lib/models/game/errors";

export const POST = apiRoute<{ id: string }>(
    { rateLimit: "gameAction", body: true },
    async ({ params, body, user, admin }) => {
        const version = numberField(body, "version");
        const action = objectField(body, "action");

        const result = await applyAction(
            admin,
            params.id,
            user.id,
            version,
            action,
        );
        if (!result.ok) {
            return failureResponse("games.actions", result, GAME_ERROR_STATUS, {
                violation: result.violation,
            });
        }
        return NextResponse.json({
            ok: true,
            version: result.version,
            events: result.events,
            payload: result.payload,
        });
    },
);
