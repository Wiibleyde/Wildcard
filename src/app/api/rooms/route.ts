import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { stringField } from "@/lib/api/validate";
import { createRoom, ROOM_ERROR_STATUS } from "@/lib/models/room";

export const POST = apiRoute(
    { rateLimit: "roomCreate", body: true },
    async ({ body, user, admin }) => {
        const moduleId = stringField(body, "moduleId");
        // Private (code-only) unless explicitly public.
        const visibility = body.visibility === "public" ? "public" : "private";
        const result = await createRoom(admin, user.id, moduleId, visibility);
        if (!result.ok) {
            return failureResponse("rooms.create", result, ROOM_ERROR_STATUS);
        }
        return NextResponse.json({ code: result.code, roomId: result.roomId });
    },
);
