import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { numberField } from "@/lib/api/validate";
import { ROOM_ERROR_STATUS, setBotCount } from "@/lib/models/room";

export const POST = apiRoute<{ code: string }>(
    { rateLimit: "roomCode", body: true },
    async ({ params, body, user, admin }) => {
        const count = numberField(body, "count");
        const result = await setBotCount(admin, user.id, params.code, count);
        if (!result.ok) {
            return failureResponse("rooms.bots", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ botCount: result.botCount });
    },
);
