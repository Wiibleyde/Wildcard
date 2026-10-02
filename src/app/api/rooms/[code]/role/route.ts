import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { oneOfField } from "@/lib/api/validate";
import { ROOM_ERROR_STATUS, setRoomRole } from "@/lib/models/room";

export const POST = apiRoute<{ code: string }>(
    { rateLimit: "roomCode", body: true },
    async ({ params, body, user, admin }) => {
        const role = oneOfField(body, "role", ["player", "spectator"]);
        const result = await setRoomRole(admin, user.id, params.code, role);
        if (!result.ok) {
            return failureResponse("rooms.role", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ role: result.role });
    },
);
