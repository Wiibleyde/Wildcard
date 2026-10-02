import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { joinRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";

// Joining is how private rooms are reached: its own tighter budget on top.
export const POST = apiRoute<{ code: string }>(
    { rateLimit: ["roomCode", "roomJoin"] },
    async ({ params, user, admin }) => {
        const result = await joinRoom(admin, user.id, params.code);
        if (!result.ok) {
            return failureResponse("rooms.join", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ roomId: result.roomId });
    },
);
