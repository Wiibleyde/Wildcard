import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { ROOM_ERROR_STATUS, startGame } from "@/lib/models/room";

export const POST = apiRoute<{ code: string }>(
    { rateLimit: "roomCode" },
    async ({ params, user, admin }) => {
        const result = await startGame(admin, user.id, params.code);
        if (!result.ok) {
            return failureResponse("rooms.start", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ gameId: result.gameId });
    },
);
