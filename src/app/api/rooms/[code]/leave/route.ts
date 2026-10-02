import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { leaveRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";

export const POST = apiRoute<{ code: string }>(
    { rateLimit: "roomCode" },
    async ({ params, user, admin }) => {
        const result = await leaveRoom(admin, user.id, params.code);
        if (!result.ok) {
            return failureResponse("rooms.leave", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ ok: true });
    },
);
