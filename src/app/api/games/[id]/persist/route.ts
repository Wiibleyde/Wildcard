import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { booleanField } from "@/lib/api/validate";
import { PERSIST_ERROR_STATUS, setPersistent } from "@/lib/models/persistence";

export const PUT = apiRoute<{ id: string }>(
    { body: true },
    async ({ params, body, user, admin }) => {
        const persistent = booleanField(body, "persistent");
        const result = await setPersistent(
            admin,
            user.id,
            params.id,
            persistent,
        );
        if (!result.ok) {
            return failureResponse(
                "games.persist",
                result,
                PERSIST_ERROR_STATUS,
            );
        }
        return NextResponse.json({ persistent, count: result.count });
    },
);
