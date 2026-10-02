import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { objectField } from "@/lib/api/validate";
import { ROOM_ERROR_STATUS, setRules } from "@/lib/models/room";

export const POST = apiRoute<{ code: string }>(
    { rateLimit: "roomCode", body: true },
    async ({ params, body, user, admin }) => {
        const rules = objectField(body, "rules");
        const result = await setRules(admin, user.id, params.code, rules);
        if (!result.ok) {
            return failureResponse("rooms.rules", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ rules: result.rules });
    },
);
